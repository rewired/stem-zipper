import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { PackToast } from '../../../common/ipc';
import { formatPathForDisplay } from '../../../common/paths';
import type { EstimateFileKind } from '../../../common/packing/estimator';
import { SUPPORTED_EXTENSIONS } from '../../../common/constants';
import { probeAudio } from '../audioProbe';
import { splitStereoWav, UnsupportedWavError, type SplitStereoWavOptions } from './splitStereo';
import type { ProgressMessage, ProgressReporter, SizedFile, SupportedExtension } from './types';

export function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export function isSupportedExtension(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension as SupportedExtension);
}

export async function createSizedFile(filePath: string): Promise<SizedFile> {
  const stats = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (!isSupportedExtension(extension)) {
    throw new Error(`Unsupported extension: ${extension}`);
  }
  return { path: filePath, size: stats.size, extension };
}

export function scanTargetFolder(folderPath: string): SizedFile[] {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const files: SizedFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!isSupportedExtension(extension)) continue;
    const absolutePath = path.join(folderPath, entry.name);
    const stats = fs.statSync(absolutePath);
    files.push({ path: absolutePath, size: stats.size, extension });
  }

  return files;
}

export function groupFilesByExtension(files: SizedFile[]): Map<SupportedExtension, SizedFile[]> {
  const groups = new Map<SupportedExtension, SizedFile[]>();
  for (const file of files) {
    const current = groups.get(file.extension) ?? [];
    current.push(file);
    groups.set(file.extension, current);
  }
  return groups;
}

function pseudoRandomForFile(file: SizedFile): number {
  const hash = crypto.createHash('sha256').update(file.path).digest();
  const value = hash.readUInt32BE(0);
  return value / 0xffffffff;
}

export function sortFilesForBestFit(files: SizedFile[]): SizedFile[] {
  return [...files].sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size;
    }
    if (a.extension !== b.extension) {
      return a.extension.localeCompare(b.extension);
    }
    const diff = pseudoRandomForFile(b) - pseudoRandomForFile(a);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
    return a.path.localeCompare(b.path);
  });
}

export function bestFitPack(files: SizedFile[], maxSizeBytes: number): SizedFile[][] {
  if (files.length === 0) {
    return [];
  }

  const sorted = sortFilesForBestFit(files);
  const bins: { items: SizedFile[]; used: number }[] = [];

  for (const file of sorted) {
    const candidateIndices: number[] = [];
    let bestRemaining = Number.POSITIVE_INFINITY;

    for (let index = 0; index < bins.length; index += 1) {
      const bin = bins[index];
      const remaining = maxSizeBytes - bin.used;
      if (file.size <= remaining) {
        if (remaining < bestRemaining) {
          bestRemaining = remaining;
          candidateIndices.length = 0;
          candidateIndices.push(index);
        } else if (remaining === bestRemaining) {
          candidateIndices.push(index);
        }
      }
    }

    if (candidateIndices.length === 0) {
      bins.push({ items: [file], used: file.size });
      continue;
    }

    const targetIndex =
      candidateIndices.length === 1
        ? candidateIndices[0]
        : candidateIndices[Math.floor(pseudoRandomForFile(file) * candidateIndices.length)];
    const targetBin = bins[targetIndex];
    targetBin.items.push(file);
    targetBin.used += file.size;
  }

  return bins.map((bin) => [...bin.items]);
}

const PREPARING_STATE = 'preparing' as const;
const PREPARING_MESSAGE: ProgressMessage = 'pack_progress_preparing';

const preparingContexts = new WeakMap<ProgressReporter, { total: number; completed: number }>();

function getPreparingContext(progress: ProgressReporter): { total: number; completed: number } {
  let context = preparingContexts.get(progress);
  if (!context) {
    context = { total: 0, completed: 0 };
    preparingContexts.set(progress, context);
  }
  return context;
}

const HEADER_READ_BYTES = 64;
const ASF_HEADER_GUID = Buffer.from([
  0x30,
  0x26,
  0xb2,
  0x75,
  0x8e,
  0x66,
  0xcf,
  0x11,
  0xa6,
  0xd9,
  0x00,
  0xaa,
  0x00,
  0x62,
  0xce,
  0x6c
]);
const OPUS_HEAD_SIGNATURE = Buffer.from('OpusHead', 'ascii');

const EXTENSION_KIND_MAP: Record<SupportedExtension, EstimateFileKind> = {
  '.wav': 'wav',
  '.flac': 'flac',
  '.mp3': 'mp3',
  '.aiff': 'aiff',
  '.ogg': 'ogg',
  '.aac': 'aac',
  '.m4a': 'm4a',
  '.opus': 'opus',
  '.wma': 'wma'
};

export function sniffFileKind(file: SizedFile): EstimateFileKind {
  let handle: number | undefined;
  try {
    handle = fs.openSync(file.path, 'r');
    const header = Buffer.alloc(HEADER_READ_BYTES);
    const bytesRead = fs.readSync(handle, header, 0, HEADER_READ_BYTES, 0);

    if (bytesRead <= 0) {
      return EXTENSION_KIND_MAP[file.extension];
    }

    const signature = header.toString('ascii', 0, Math.min(bytesRead, HEADER_READ_BYTES));
    if (signature.startsWith('RIFF') && header.toString('ascii', 8, 12) === 'WAVE') {
      return 'wav';
    }
    if (signature.startsWith('ID3') || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) {
      return 'mp3';
    }
    if (signature.startsWith('OggS')) {
      if (header.subarray(0, bytesRead).includes(OPUS_HEAD_SIGNATURE)) {
        return 'opus';
      }
      return 'ogg';
    }
    if (bytesRead >= 4 && header.toString('ascii', 0, 4) === 'fLaC') {
      return 'flac';
    }
    if (bytesRead >= 12 && header.toString('ascii', 0, 4) === 'FORM') {
      const formType = header.toString('ascii', 8, 12);
      if (formType === 'AIFF' || formType === 'AIFC') {
        return 'aiff';
      }
    }
    if (bytesRead >= 4 && header[0] === 0xff && (header[1] & 0xf6) === 0xf0) {
      return 'aac';
    }
    if (bytesRead >= 12 && header.toString('ascii', 4, 8) === 'ftyp') {
      const brand = header.toString('ascii', 8, 12);
      if (brand.startsWith('M4A') || brand.startsWith('isom') || brand.startsWith('mp42')) {
        return 'm4a';
      }
    }
    if (bytesRead >= ASF_HEADER_GUID.length && ASF_HEADER_GUID.compare(header, 0, ASF_HEADER_GUID.length, 0, ASF_HEADER_GUID.length) === 0) {
      return 'wma';
    }
  } catch (error) {
    console.warn('Failed to sniff audio header for kind detection', file.path, error);
  } finally {
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch (closeError) {
        console.warn('Failed to close header sniff handle', file.path, closeError);
      }
    }
  }
  return EXTENSION_KIND_MAP[file.extension];
}

export interface ExpandFilesOptions {
  maxSizeBytes: number;
  splitThresholdBytes?: number;
  progress?: ProgressReporter;
  emitToast?: (toast: PackToast) => void;
  splitter?: (filePath: string, options?: SplitStereoWavOptions) => Promise<SizedFile[]>;
  registerTempFile?: (filePath: string) => void;
  forceSplit?: Set<string>;
}

export async function expandFiles(files: SizedFile[], options: ExpandFilesOptions): Promise<SizedFile[]> {
  const expanded: SizedFile[] = [];
  const threshold = options.splitThresholdBytes ?? options.maxSizeBytes;
  const forceSet = options.forceSplit ?? new Set<string>();
  const progressReporter = options.progress;
  const progressContext = progressReporter ? getPreparingContext(progressReporter) : undefined;
  const predictedSplits = files.filter((file) => (file.size > threshold || forceSet.has(file.path)) && file.extension === '.wav').length;

  const applyTotalDelta = (delta: number) => {
    if (!progressReporter || !progressContext || delta === 0) {
      return;
    }
    progressReporter.addToTotal(delta);
    progressContext.total = Math.max(0, progressContext.total + delta);
    if (progressContext.completed > progressContext.total) {
      progressContext.completed = progressContext.total;
    }
  };

  if (progressReporter && progressContext) {
    const totalDelta = files.length + predictedSplits;
    if (totalDelta > 0) {
      applyTotalDelta(totalDelta);
      progressReporter.tick({ state: PREPARING_STATE, message: PREPARING_MESSAGE });
    }
  }

  const beginUnit = () => {
    progressReporter?.fileStart({ state: PREPARING_STATE, message: PREPARING_MESSAGE });
  };

  const completeUnit = () => {
    progressReporter?.fileDone({ state: PREPARING_STATE, message: PREPARING_MESSAGE });
    if (progressContext) {
      progressContext.completed = Math.min(progressContext.total, progressContext.completed + 1);
    }
  };

  const notifySkip = (file: SizedFile, reason: string) => {
    console.info('Skipping stereo split for file', { file: file.path, reason });
    options.emitToast?.({
      id: `split-info:${file.path}`,
      level: 'info',
      messageKey: 'pack_info_skip_stereo_split_non_wav',
      params: { file: formatPathForDisplay(file.path) }
    });
  };

  const notifyError = (file: SizedFile, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Split failed; packaging original file instead', { file: file.path, error: message });
    options.emitToast?.({
      id: `split-error:${file.path}`,
      level: 'warning',
      messageKey: 'pack_warn_split_fallback',
      params: { file: formatPathForDisplay(file.path) }
    });
  };

  for (const file of files) {
    const mustSplit = forceSet.has(file.path);
    const sizeExceedsThreshold = file.size > threshold;
    const shouldAttemptSplit = file.extension === '.wav' && (sizeExceedsThreshold || mustSplit);
    const predictedExtraUnits = shouldAttemptSplit ? 1 : 0;
    const baseCompleted = progressContext?.completed ?? 0;
    const unitsForFile = 1 + predictedExtraUnits;

    beginUnit();

    const onSplitProgress =
      shouldAttemptSplit && progressReporter && progressContext && progressContext.total > 0
        ? (fraction: number) => {
            const bounded = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
            const unitsProgress = unitsForFile * bounded;
            const percent =
              progressContext.total === 0
                ? 0
                : ((baseCompleted + unitsProgress) / progressContext.total) * 100;
            progressReporter.tick({ state: PREPARING_STATE, message: PREPARING_MESSAGE, percent });
          }
        : undefined;

    if (shouldAttemptSplit) {
      try {
        const probe = await probeAudio(file.path);
        if (probe.codec !== 'wav_pcm' && probe.codec !== 'wav_float') {
          notifySkip(file, `codec=${probe.codec}`);
          applyTotalDelta(-predictedExtraUnits);
          expanded.push(file);
        } else if (!probe.num_channels || probe.num_channels < 2) {
          notifySkip(file, `channels=${probe.num_channels ?? 'unknown'}`);
          applyTotalDelta(-predictedExtraUnits);
          expanded.push(file);
        } else {
          const splitOptions: SplitStereoWavOptions = {
            registerTemp: options.registerTempFile,
            onProgress: onSplitProgress
          };
          const split = options.splitter
            ? await options.splitter(file.path, splitOptions)
            : await splitStereoWav(file.path, splitOptions);
          if (options.registerTempFile && options.splitter) {
            for (const entry of split) {
              options.registerTempFile(entry.path);
            }
          }
          expanded.push(...split);

          if (progressReporter && progressContext) {
            const actualExtra = Math.max(0, split.length - 1);
            const delta = actualExtra - predictedExtraUnits;
            if (delta !== 0) {
              applyTotalDelta(delta);
            }
            for (let index = 1; index < split.length; index += 1) {
              beginUnit();
              completeUnit();
            }
          }
        }
      } catch (error) {
        if (error instanceof UnsupportedWavError) {
          notifySkip(file, error.message);
          applyTotalDelta(-predictedExtraUnits);
          expanded.push(file);
        } else if (mustSplit) {
          options.emitToast?.({
            id: `split-error:${file.path}`,
            level: 'warning',
            messageKey: 'warn_split_mono_failed',
            params: { name: formatPathForDisplay(file.path) }
          });
          applyTotalDelta(-predictedExtraUnits);
          expanded.push(file);
        } else {
          notifyError(file, error);
          applyTotalDelta(-predictedExtraUnits);
          expanded.push(file);
        }
      }
    } else {
      expanded.push(file);
    }

    completeUnit();
  }

  if (progressReporter && progressContext && progressContext.completed >= progressContext.total) {
    preparingContexts.delete(progressReporter);
  }

  return expanded;
}
