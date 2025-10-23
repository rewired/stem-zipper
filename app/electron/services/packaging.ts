import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WaveFile } from 'wavefile';
import { ZipFile } from 'yazl';
import type { FileEntry, PackProgress, RendererFileAction } from '../../common/ipc';
import {
  SUPPORTED_EXTENSIONS,
  type SupportedExtension,
  type SupportedAudioKind
} from '../../common/constants';
import { formatPathForDisplay } from '../../common/paths';
import { formatMessage, type LocaleKey } from '../../common/i18n';
import { APP_VERSION } from '../../common/version';

export const STAMP_FILENAME = '_stem-zipper.txt';
const STEM_ZIPPER_LOGO = `░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░`;
export const STEM_ZIPPER_STAMP = `${STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v${APP_VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!`;

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

const extensionToKindMap: Record<SupportedExtension, SupportedAudioKind> = {
  '.wav': 'wav',
  '.flac': 'flac',
  '.mp3': 'mp3',
  '.aiff': 'aiff',
  '.ogg': 'ogg',
  '.aac': 'aac',
  '.wma': 'wma'
};

export interface SizedFile {
  path: string;
  size: number;
  extension: SupportedExtension;
}


function isSupportedExtension(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension as SupportedExtension);
}

const WAV_HEADER_MIN_LENGTH = 24;
const WAV_NUM_CHANNELS_OFFSET = 22;

function readWavStereoFlag(filePath: string): boolean | undefined {
  let handle: number | undefined;
  try {
    handle = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(WAV_HEADER_MIN_LENGTH);
    const bytesRead = fs.readSync(handle, buffer, 0, buffer.length, 0);
    if (bytesRead < WAV_NUM_CHANNELS_OFFSET + 2) {
      return undefined;
    }
    const channels = buffer.readUInt16LE(WAV_NUM_CHANNELS_OFFSET);
    if (channels <= 0) {
      return undefined;
    }
    return channels === 2;
  } catch (error) {
    console.warn('Failed to inspect WAV header for stereo detection', filePath, error);
    return undefined;
  } finally {
    if (typeof handle === 'number') {
      try {
        fs.closeSync(handle);
      } catch (closeError) {
        console.warn('Failed to close WAV header handle', filePath, closeError);
      }
    }
  }
}

function resolveAction(sizeBytes: number, extension: SupportedExtension, maxSizeBytes: number): RendererFileAction {
  if (sizeBytes > maxSizeBytes) {
    return extension === '.wav' ? 'split_mono' : 'split_zip';
  }
  return 'normal';
}

function createSizedFile(filePath: string, stats: fs.Stats): SizedFile {
  const extension = path.extname(filePath).toLowerCase();
  if (!isSupportedExtension(extension)) {
    throw new Error(`Unsupported extension: ${extension}`);
  }
  return {
    path: filePath,
    size: stats.size,
    extension
  };
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
    files.push(createSizedFile(absolutePath, stats));
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

export function analyzeFolder(folderPath: string, maxSizeMb: number): FileEntry[] {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const sizedFiles = scanTargetFolder(folderPath);
  const entries: FileEntry[] = sizedFiles.map((file) => ({
    name: path.basename(file.path),
    sizeMb: toMb(file.size),
    action: resolveAction(file.size, file.extension, maxSizeBytes),
    path: file.path,
    sizeBytes: file.size,
    kind: extensionToKindMap[file.extension],
    stereo: file.extension === '.wav' ? readWavStereoFlag(file.path) : undefined
  }));

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

export async function createBrandedZip(zipName: string, files: SizedFile[], outDir: string): Promise<string> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${zipName}.zip`);
  const zip = new ZipFile();

  for (const file of files) {
    zip.addFile(file.path, path.basename(file.path));
  }
  zip.addBuffer(Buffer.from(STEM_ZIPPER_STAMP, 'utf-8'), STAMP_FILENAME, { compress: false });

  return new Promise((resolve, reject) => {
    zip
      .outputStream.pipe(fs.createWriteStream(zipPath))
      .on('close', () => resolve(zipPath))
      .on('error', reject);
    zip.end();
  });
}

async function getSizedFile(filePath: string): Promise<SizedFile> {
  const stats = await fs.promises.stat(filePath);
  return createSizedFile(filePath, stats);
}

async function splitStereoWav(filePath: string): Promise<SizedFile[]> {
  const buffer = await fs.promises.readFile(filePath);
  const wav = new WaveFile(buffer);
  const fmt = wav.fmt as { numChannels?: number; sampleRate?: number } | undefined;
  if ((fmt?.numChannels ?? 0) !== 2) {
    return [await getSizedFile(filePath)];
  }

  const { dir, name, ext } = path.parse(filePath);

  // Build mono files by de-interleaving samples and writing fresh files
  const getSamples = (wav as unknown as { getSamples: (interleaved: false, OutputObject: { new (...args: unknown[]): Float64Array }) => Float64Array[] }).getSamples;
  const channels = getSamples(false, Float64Array);

  const leftSamples = channels[0];
  const rightSamples = channels[1];
  const sampleRate = fmt?.sampleRate ?? 44100;
  const bitDepthCode = wav.bitDepth as string || '16';

  const left = new WaveFile();
  left.fromScratch(1, sampleRate, bitDepthCode, [leftSamples]);
  const leftPath = path.join(dir, `${name}_L${ext}`);

  const right = new WaveFile();
  right.fromScratch(1, sampleRate, bitDepthCode, [rightSamples]);
  const rightPath = path.join(dir, `${name}_R${ext}`);

  await fs.promises.writeFile(leftPath, left.toBuffer());
  await fs.promises.writeFile(rightPath, right.toBuffer());
  await fs.promises.unlink(filePath);

  return Promise.all([getSizedFile(leftPath), getSizedFile(rightPath)]);
}

async function expandFiles(
  files: SizedFile[],
  maxSizeBytes: number,
  onProgress?: (progress: PackProgress) => void
): Promise<SizedFile[]> {
  const expanded: SizedFile[] = [];
  const toSplit = files.filter((f) => f.size > maxSizeBytes && f.extension === '.wav').length;
  let processed = 0;
  for (const file of files) {
    if (file.size > maxSizeBytes && file.extension === '.wav') {
      const split = await splitStereoWav(file.path);
      expanded.push(...split);
      processed += 1;
      if (onProgress && toSplit > 0) {
        onProgress({
          state: 'analyzing',
          current: processed,
          total: toSplit,
          percent: Math.floor((processed / toSplit) * 100),
          message: 'splitting'
        });
      }
    } else {
      expanded.push(file);
    }
  }
  return expanded;
}

export async function packFolder(
  folderPath: string,
  maxSizeMb: number,
  locale: LocaleKey,
  onProgress: (progress: PackProgress) => void
): Promise<number> {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const sizedFiles = scanTargetFolder(folderPath);
  if (sizedFiles.length === 0) {
    const noFilesMessage = formatMessage(locale, 'msg_no_files');
    const error: PackProgress = {
      state: 'error',
      current: 0,
      total: 0,
      percent: 0,
      message: 'no_files',
      errorMessage: noFilesMessage
    };
    onProgress(error);
    throw new Error(noFilesMessage);
  }

  onProgress({ state: 'analyzing', current: 0, total: 0, percent: 0, message: 'analyzing' });
  const groupedByExtension = groupFilesByExtension(sizedFiles);
  const orderedExtensions = Array.from(groupedByExtension.keys()).sort();
  const zipGroups: SizedFile[][] = [];

  for (const extension of orderedExtensions) {
    const filesForExtension = groupedByExtension.get(extension);
    if (!filesForExtension || filesForExtension.length === 0) continue;
    const expanded = await expandFiles(filesForExtension, maxSizeBytes, onProgress);
    const packed = bestFitPack(expanded, maxSizeBytes);
    zipGroups.push(...packed);
  }

  const total = zipGroups.length;

  for (let index = 0; index < total; index += 1) {
    const group = zipGroups[index];
    const zipName = `stems-${String(index + 1).padStart(2, '0')}`;
    onProgress({
      state: 'packing',
      current: index,
      total,
      percent: total === 0 ? 0 : Math.floor((index / total) * 100),
      message: 'packing',
      currentZip: zipName
    });
    await createBrandedZip(zipName, group, folderPath);
    onProgress({
      state: 'packing',
      current: index + 1,
      total,
      percent: Math.floor(((index + 1) / total) * 100),
      message: 'packing',
      currentZip: zipName
    });
  }

  onProgress({ state: 'finished', current: total, total, percent: 100, message: 'finished' });
  return total;
}

function randomSizeMb(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export async function createTestData(targetFolder: string, count = 20): Promise<number> {
  await fs.promises.mkdir(targetFolder, { recursive: true });
  const extensions = SUPPORTED_EXTENSIONS;
  for (let index = 1; index <= count; index += 1) {
    const ext = extensions[index % extensions.length];
    const sizeMb = randomSizeMb(2, 20);
    const filename = `testfile_${String(index).padStart(3, '0')}${ext}`;
    const filePath = path.join(targetFolder, filename);
    await createDummyFile(filePath, sizeMb);
  }
  return count;
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

export { formatPathForDisplay };


