import path from 'node:path';
import { randomBytes } from 'node:crypto';
import fs from 'fs-extra';
import archiver from 'archiver';
import { decode } from 'wav-decoder';
import { encode } from 'wav-encoder';
import {
  DEFAULT_MAX_SIZE_MB,
  MAX_SIZE_LIMIT_MB,
  STEM_ZIPPER_STAMP,
  STAMP_FILENAME,
  SUPPORTED_EXTENSIONS
} from '@common/constants';
import type {
  CreateTestDataResult,
  PackProgress,
  PackResult,
  StemAction,
  StemAnalysisEntry,
  StemAnalysisResult
} from '@common/types';
import { ErrorCodes, StemZipperError } from './errors';

const MB = 1024 * 1024;

interface FileSizeEntry {
  path: string;
  size: number;
}

export const sanitizeMaxSize = (value: number | undefined): number => {
  if (!value || Number.isNaN(value) || value <= 0) {
    return DEFAULT_MAX_SIZE_MB;
  }
  if (value > MAX_SIZE_LIMIT_MB) {
    return MAX_SIZE_LIMIT_MB;
  }
  return value;
};

export const analyzeDirectory = async (
  folder: string,
  maxSizeMb: number
): Promise<StemAnalysisResult> => {
  const resolvedFolder = path.resolve(folder);
  const exists = await fs.pathExists(resolvedFolder);
  if (!exists) {
    throw new StemZipperError(ErrorCodes.InvalidPath, `Folder not found: ${resolvedFolder}`);
  }

  const entries = await fs.readdir(resolvedFolder);
  const maxBytes = Math.floor(maxSizeMb * MB);
  const files: StemAnalysisEntry[] = [];

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      continue;
    }
    const fullPath = path.join(resolvedFolder, entry);
    const stats = await fs.stat(fullPath);
    const action: StemAction = stats.size > maxBytes ? (ext === '.wav' ? 'split_mono' : 'split_zip') : 'normal';
    files.push({
      fileName: entry,
      sizeMb: Number((stats.size / MB).toFixed(2)),
      action
    });
  }

  return {
    folder: resolvedFolder,
    files
  };
};

const splitStereoWav = async (filepath: string): Promise<string[]> => {
  const buffer = await fs.readFile(filepath);
  const audioData = await decode(buffer);
  const channels = audioData.channelData;

  if (!channels || channels.length !== 2) {
    return [filepath];
  }

  const [left, right] = channels;
  const base = path.parse(filepath);
  const leftPath = path.join(base.dir, `${base.name}_L${base.ext}`);
  const rightPath = path.join(base.dir, `${base.name}_R${base.ext}`);

  const encodeChannel = async (channel: Float32Array, output: string) => {
    const encoded = await encode({
      sampleRate: audioData.sampleRate,
      channelData: [channel]
    });
    const nodeBuffer = Buffer.from(encoded as ArrayBuffer);
    await fs.writeFile(output, nodeBuffer);
  };

  await encodeChannel(left, leftPath);
  await encodeChannel(right, rightPath);
  await fs.remove(filepath);
  return [leftPath, rightPath];
};

const bestFitPack = (files: FileSizeEntry[], maxSizeBytes: number): FileSizeEntry[][] => {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const bins: FileSizeEntry[][] = [];

  for (const file of sorted) {
    let bestBin: FileSizeEntry[] | null = null;
    let minimalRemaining = maxSizeBytes + 1;

    for (const bin of bins) {
      const used = bin.reduce((acc, current) => acc + current.size, 0);
      const remaining = maxSizeBytes - used;
      if (file.size <= remaining && remaining < minimalRemaining) {
        bestBin = bin;
        minimalRemaining = remaining;
      }
    }

    if (bestBin) {
      bestBin.push(file);
    } else {
      bins.push([file]);
    }
  }

  return bins;
};

const createZip = async (name: string, files: FileSizeEntry[], outDir: string): Promise<string> => {
  const outputDir = path.resolve(outDir);
  await fs.ensureDir(outputDir);
  const archivePath = path.join(outputDir, `${name}.zip`);

  return new Promise<string>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(archivePath);

    stream.on('close', () => resolve(archivePath));
    stream.on('error', (error) => reject(error));
    archive.on('error', (error) => reject(error));

    archive.pipe(stream);
    for (const file of files) {
      archive.file(file.path, { name: path.basename(file.path) });
    }
    archive.append(STEM_ZIPPER_STAMP, { name: STAMP_FILENAME });
    archive.finalize().catch(reject);
  });
};

const createDummyFile = async (filepath: string, sizeMb: number) => {
  const targetBytes = Math.max(1, Math.floor(sizeMb * MB));
  const header = Buffer.from('FAKEAUDIO');
  if (targetBytes <= header.length) {
    await fs.writeFile(filepath, header.subarray(0, targetBytes));
    return;
  }
  const remaining = targetBytes - header.length;
  const random = randomBytes(remaining);
  await fs.writeFile(filepath, Buffer.concat([header, random]));
};

export const createTestData = async (
  outputDir: string,
  count = 20,
  minSize = 2,
  maxSize = 20
): Promise<CreateTestDataResult> => {
  const resolved = path.resolve(outputDir);
  await fs.ensureDir(resolved);
  const generated: string[] = [];

  for (let index = 1; index <= count; index += 1) {
    const ext = SUPPORTED_EXTENSIONS[Math.floor(Math.random() * SUPPORTED_EXTENSIONS.length)];
    const size = Number((Math.random() * (maxSize - minSize) + minSize).toFixed(2));
    const filename = `testfile_${String(index).padStart(3, '0')}${ext}`;
    const filePath = path.join(resolved, filename);
    await createDummyFile(filePath, size);
    generated.push(filePath);
  }

  return {
    outputDir: resolved,
    count,
    files: generated
  };
};

const expandFilesForPacking = async (files: string[], maxBytes: number): Promise<FileSizeEntry[]> => {
  const expanded: FileSizeEntry[] = [];
  for (const file of files) {
    const stats = await fs.stat(file);
    const ext = path.extname(file).toLowerCase();
    if (stats.size > maxBytes && ext === '.wav') {
      const splitFiles = await splitStereoWav(file);
      for (const splitFile of splitFiles) {
        const splitStats = await fs.stat(splitFile);
        expanded.push({ path: splitFile, size: splitStats.size });
      }
    } else {
      expanded.push({ path: file, size: stats.size });
    }
  }
  return expanded;
};

export const packDirectory = async (
  folder: string,
  maxSizeMb: number,
  onProgress?: (progress: PackProgress) => void
): Promise<PackResult> => {
  const resolvedFolder = path.resolve(folder);
  const exists = await fs.pathExists(resolvedFolder);
  if (!exists) {
    throw new StemZipperError(ErrorCodes.InvalidPath, `Folder not found: ${resolvedFolder}`);
  }
  const entries = await fs.readdir(resolvedFolder);
  const supported = entries
    .filter((entry) => SUPPORTED_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(resolvedFolder, entry));

  if (supported.length === 0) {
    throw new StemZipperError(ErrorCodes.NoSupportedFiles, 'No supported audio files found.');
  }

  const maxBytes = Math.floor(maxSizeMb * MB);
  const expanded = await expandFilesForPacking(supported, maxBytes);
  const groups = bestFitPack(expanded, maxBytes);
  const archives: string[] = [];

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const archiveName = `stems-${String(index + 1).padStart(2, '0')}`;
    onProgress?.({ current: index, total: groups.length, archiveName });
    const archivePath = await createZip(archiveName, group, resolvedFolder);
    archives.push(archivePath);
    onProgress?.({ current: index + 1, total: groups.length, archiveName });
  }

  return {
    folder: resolvedFolder,
    archives,
    totalArchives: groups.length
  };
};

export const handleServiceCall = async <T>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    return { success: true, data } as const;
  } catch (error) {
    if (error instanceof StemZipperError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      } as const;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message
      }
    } as const;
  }
};
