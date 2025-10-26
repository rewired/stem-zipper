import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FileEntry, PackStatusEvent, PackToast, RendererFileAction } from '../../../common/ipc';
import { formatPathForDisplay } from '../../../common/paths';
import type { EstimateFileKind } from '../../../common/packing/estimator';
import {
  createSizedFile,
  scanTargetFolder,
  sniffFileKind,
  toMb
} from './expandFiles';
import { createProgressReporter } from './progress';
import type { PackOptions, PackStrategy, ProgressEvent, SizedFile, StrategyResult } from './types';
import { splitStereoWav, UnsupportedWavError } from './splitStereo';

type StrategyLoader = () => Promise<PackStrategy>;

const STRATEGY_LOADERS: Record<PackOptions['method'], StrategyLoader> = {
  zip_best_fit: async () => (await import('./zipStrategy')).zipBestFitStrategy,
  seven_z_split: async () => (await import('./sevenZStrategy')).sevenZSplitStrategy
};

async function loadStrategy(method: PackOptions['method']): Promise<PackStrategy> {
  const loader = STRATEGY_LOADERS[method] ?? STRATEGY_LOADERS.zip_best_fit;
  return loader();
}

function resolveAction(sizeBytes: number, extension: string, maxSizeBytes: number): RendererFileAction {
  if (sizeBytes > maxSizeBytes) {
    return extension === '.wav' ? 'split_mono' : 'split_zip';
  }
  return 'normal';
}

async function isLikelyStereoWav(file: SizedFile): Promise<boolean> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(file.path, 'r');
    const riffHeader = Buffer.alloc(12);
    const riffRead = await handle.read(riffHeader, 0, 12, 0);
    if (riffRead.bytesRead < 12) {
      return false;
    }
    if (riffHeader.toString('ascii', 0, 4) !== 'RIFF' || riffHeader.toString('ascii', 8, 12) !== 'WAVE') {
      return false;
    }

    let offset = 12;
    const chunkHeader = Buffer.alloc(8);

    while (offset + 8 <= file.size) {
      const headerRead = await handle.read(chunkHeader, 0, 8, offset);
      if (headerRead.bytesRead < 8) {
        break;
      }
      const chunkId = chunkHeader.toString('ascii', 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      if (chunkId === 'fmt ') {
        const fmtBuffer = Buffer.alloc(4);
        const fmtRead = await handle.read(fmtBuffer, 0, 4, offset + 8);
        if (fmtRead.bytesRead < 4) {
          return false;
        }
        const channels = fmtBuffer.readUInt16LE(2);
        return channels >= 2;
      }
      const paddedSize = chunkSize + (chunkSize % 2);
      if (paddedSize <= 0) {
        break;
      }
      offset += 8 + paddedSize;
    }
  } catch (error) {
    console.warn('Failed to inspect WAV header for stereo flag', file.path, error);
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch (closeError) {
        console.warn('Failed to close WAV handle after inspection', file.path, closeError);
      }
    }
  }
  return false;
}

async function resolveSizedFiles(paths: string[], fallbackDir: string): Promise<SizedFile[]> {
  if (paths.length === 0) {
    return scanTargetFolder(fallbackDir);
  }
  const resolved: SizedFile[] = [];
  const seen = new Set<string>();
  for (const candidate of paths) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const sized = await createSizedFile(candidate);
      resolved.push(sized);
    } catch (error) {
      console.warn('Skipping file during pack preparation', candidate, error);
    }
  }
  return resolved;
}

async function prepareFilesForStrategy(options: PackOptions): Promise<SizedFile[]> {
  return resolveSizedFiles(options.files, options.outputDir);
}

export async function analyzeFolder(folderPath: string, maxSizeMb: number): Promise<FileEntry[]> {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const sizedFiles = scanTargetFolder(folderPath);
  const entries: FileEntry[] = await Promise.all(
    sizedFiles.map(async (file) => {
      const action = resolveAction(file.size, file.extension, maxSizeBytes);
      const shouldInspectStereo = file.extension === '.wav' && file.size > maxSizeBytes;
      const stereo = shouldInspectStereo && (await isLikelyStereoWav(file)) ? true : undefined;
      const kind: EstimateFileKind = sniffFileKind(file);
      return {
        name: path.basename(file.path),
        sizeMb: toMb(file.size),
        action,
        path: file.path,
        sizeBytes: file.size,
        kind,
        stereo
      };
    })
  );

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export interface PackExecutionOptions {
  options: PackOptions;
  onProgress: (progress: ProgressEvent) => void;
  emitStatus?: (event: PackStatusEvent) => void;
}

export async function pack({ options, onProgress, emitStatus }: PackExecutionOptions): Promise<StrategyResult> {
  const files = await prepareFilesForStrategy(options);
  if (files.length === 0) {
    throw new Error('pack_error_no_files');
  }
  const strategy = await loadStrategy(options.method);
  const progress = createProgressReporter(onProgress);

  const emitToast = emitStatus
    ? (toast: PackToast) => {
        emitStatus({ type: 'toast', toast });
      }
    : undefined;

  const result = await strategy({
    files,
    options,
    progress,
    extras: [],
    emitToast
  });

  return result;
}

function randomSizeMb(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function createDummyFile(filePath: string, sizeMb: number): Promise<void> {
  const bytes = Math.max(1, Math.floor(sizeMb * 1024 * 1024));
  const header = Buffer.from('FAKEAUDIO');
  const remaining = bytes - header.length;
  const stream = fs.createWriteStream(filePath);
  stream.write(header);
  if (remaining > 0) {
    const buffer = crypto.randomBytes(remaining);
    stream.write(buffer);
  }
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });
}

export async function createTestData(targetFolder: string, count = 20): Promise<number> {
  await fs.promises.mkdir(targetFolder, { recursive: true });
  const extensions = ['.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.m4a', '.opus', '.wma'] as const;
  for (let index = 1; index <= count; index += 1) {
    const ext = extensions[index % extensions.length];
    const sizeMb = randomSizeMb(2, 20);
    const filename = `testfile_${String(index).padStart(3, '0')}${ext}`;
    const filePath = path.join(targetFolder, filename);
    await createDummyFile(filePath, sizeMb);
  }
  return count;
}

export { formatPathForDisplay, splitStereoWav, UnsupportedWavError };
