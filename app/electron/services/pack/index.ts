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
import { probeAudio } from '../audioProbe';

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
      const shouldInspect = file.extension === '.wav';
      let stereo: boolean | undefined;
      let codec: FileEntry['codec'];
      let numChannels: number | undefined;
      let headerBytes: number | undefined;
      if (shouldInspect) {
        try {
          const probe = await probeAudio(file.path);
          codec = probe.codec;
          if (typeof probe.num_channels === 'number') {
            numChannels = probe.num_channels;
            stereo = probe.num_channels >= 2 ? true : probe.num_channels === 1 ? false : undefined;
          }
          if (typeof probe.header_bytes === 'number') {
            headerBytes = probe.header_bytes;
          }
        } catch (error) {
          console.warn('Audio probe failed during analysis', file.path, error);
        }
      }
      const kind: EstimateFileKind = sniffFileKind(file);
      return {
        name: path.basename(file.path),
        sizeMb: toMb(file.size),
        action,
        path: file.path,
        sizeBytes: file.size,
        kind,
        stereo,
        codec,
        num_channels: numChannels,
        header_bytes: headerBytes
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
  const tempArtifacts = new Set<string>();
  const registerTempFile = (filePath: string) => {
    tempArtifacts.add(filePath);
  };

  const emitToast = emitStatus
    ? (toast: PackToast) => {
        emitStatus({ type: 'toast', toast });
      }
    : undefined;

  try {
    const result = await strategy({
      files,
      options,
      progress,
      extras: [],
      emitToast,
      registerTempFile
    });

    return result;
  } finally {
    await Promise.all(
      Array.from(tempArtifacts).map((artifact) =>
        fs.promises
          .rm(artifact, { recursive: true, force: true })
          .catch((error) => console.warn('Failed to clean up temp artifact', artifact, error))
      )
    );
  }
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
