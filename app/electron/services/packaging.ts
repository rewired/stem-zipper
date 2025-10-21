import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WaveFile } from 'wavefile';
import { ZipFile } from 'yazl';
import type { FileEntry, PackProgress, RendererFileAction } from '@common/ipc';
import { SUPPORTED_EXTENSIONS } from '@common/constants';
import { formatPathForDisplay } from '@common/paths';
import { formatMessage, type LocaleKey } from '@common/i18n';

const VERSION = '0.8';
export const STAMP_FILENAME = '_stem-zipper.txt';
const STEM_ZIPPER_LOGO = `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ v${VERSION} ░`;
export const STEM_ZIPPER_STAMP = `${STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v${VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!`;

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface SizedFile {
  path: string;
  size: number;
  extension: SupportedExtension;
}

function isSupportedExtension(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension as SupportedExtension);
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
    path: file.path
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
  if (wav.fmt?.numChannels !== 2) {
    return [await getSizedFile(filePath)];
  }

  const { dir, name, ext } = path.parse(filePath);

  const left = new WaveFile(buffer);
  left.toMono(0);
  const leftPath = path.join(dir, `${name}_L${ext}`);

  const right = new WaveFile(buffer);
  right.toMono(1);
  const rightPath = path.join(dir, `${name}_R${ext}`);

  await fs.promises.writeFile(leftPath, left.toBuffer());
  await fs.promises.writeFile(rightPath, right.toBuffer());
  await fs.promises.unlink(filePath);

  return Promise.all([getSizedFile(leftPath), getSizedFile(rightPath)]);
}

async function expandFiles(files: SizedFile[], maxSizeBytes: number): Promise<SizedFile[]> {
  const expanded: SizedFile[] = [];
  for (const file of files) {
    if (file.size > maxSizeBytes && file.extension === '.wav') {
      const split = await splitStereoWav(file.path);
      expanded.push(...split);
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
    const expanded = await expandFiles(filesForExtension, maxSizeBytes);
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
