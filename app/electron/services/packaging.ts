import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WaveFile } from 'wavefile';
import { ZipFile } from 'yazl';
import type { FileEntry, PackProgress, RendererFileAction } from '@common/ipc';
import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_LIMIT_MB, SUPPORTED_EXTENSIONS } from '@common/constants';
import { ensureValidMaxSize } from '@common/validation';
import { formatPathForDisplay } from '@common/paths';

const VERSION = '0.8';
const STAMP_FILENAME = '_stem-zipper.txt';
const STEM_ZIPPER_LOGO = `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ v${VERSION} ░`;
const STEM_ZIPPER_STAMP = `${STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v${VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!`;

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function resolveAction(sizeBytes: number, extension: string, maxSizeBytes: number): RendererFileAction {
  if (sizeBytes > maxSizeBytes) {
    return extension === '.wav' ? 'split_mono' : 'split_zip';
  }
  return 'normal';
}

export function analyzeFolder(folderPath: string, maxSizeMb: number): FileEntry[] {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const entries: FileEntry[] = [];
  const files = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile()) continue;
    const extension = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) continue;
    const absolutePath = path.join(folderPath, file.name);
    const stats = fs.statSync(absolutePath);
    const action = resolveAction(stats.size, extension, maxSizeBytes);
    entries.push({
      name: file.name,
      sizeMb: toMb(stats.size),
      action,
      path: absolutePath
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

async function createZip(zipName: string, files: string[], outDir: string): Promise<string> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${zipName}.zip`);
  const zip = new ZipFile();

  for (const file of files) {
    zip.addFile(file, path.basename(file));
  }
  zip.addBuffer(Buffer.from(STEM_ZIPPER_STAMP, 'utf-8'), STAMP_FILENAME);

  return new Promise((resolve, reject) => {
    zip
      .outputStream.pipe(fs.createWriteStream(zipPath))
      .on('close', () => resolve(zipPath))
      .on('error', reject);
    zip.end();
  });
}

interface SizedFile {
  path: string;
  size: number;
}

function bestFitPack(files: SizedFile[], maxSizeBytes: number): SizedFile[][] {
  const sorted = [...files].sort((a, b) => b.size - a.size);
  const bins: SizedFile[][] = [];

  for (const file of sorted) {
    let bestIndex = -1;
    let minimalRemaining = maxSizeBytes + 1;
    for (let index = 0; index < bins.length; index += 1) {
      const bin = bins[index];
      const used = bin.reduce((sum, entry) => sum + entry.size, 0);
      const remaining = maxSizeBytes - used;
      if (file.size <= remaining && remaining < minimalRemaining) {
        bestIndex = index;
        minimalRemaining = remaining;
      }
    }

    if (bestIndex === -1) {
      bins.push([file]);
    } else {
      bins[bestIndex].push(file);
    }
  }

  return bins;
}

async function splitStereoWav(filePath: string): Promise<SizedFile[]> {
  const buffer = await fs.promises.readFile(filePath);
  const wav = new WaveFile(buffer);
  if (wav.fmt?.numChannels !== 2) {
    return [{ path: filePath, size: buffer.byteLength }];
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

  const leftStats = await fs.promises.stat(leftPath);
  const rightStats = await fs.promises.stat(rightPath);
  return [
    { path: leftPath, size: leftStats.size },
    { path: rightPath, size: rightStats.size }
  ];
}

async function expandFiles(files: string[], maxSizeBytes: number): Promise<SizedFile[]> {
  const expanded: SizedFile[] = [];
  for (const file of files) {
    const stats = await fs.promises.stat(file);
    if (stats.size > maxSizeBytes && file.toLowerCase().endsWith('.wav')) {
      const split = await splitStereoWav(file);
      expanded.push(...split);
    } else {
      expanded.push({ path: file, size: stats.size });
    }
  }
  return expanded;
}

function gatherSupportedFiles(folderPath: string): string[] {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  const supported: string[] = [];
  for (const file of files) {
    if (!file.isFile()) continue;
    const extension = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) continue;
    supported.push(path.join(folderPath, file.name));
  }
  return supported;
}

export async function packFolder(
  folderPath: string,
  maxSizeMb: number,
  onProgress: (progress: PackProgress) => void
): Promise<number> {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const supportedFiles = gatherSupportedFiles(folderPath);
  if (supportedFiles.length === 0) {
    const error: PackProgress = {
      state: 'error',
      current: 0,
      total: 0,
      percent: 0,
      message: 'no_files',
      errorMessage: 'No supported files found.'
    };
    onProgress(error);
    throw new Error('No supported files found');
  }

  onProgress({ state: 'analyzing', current: 0, total: 0, percent: 0, message: 'analyzing' });
  const expanded = await expandFiles(supportedFiles, maxSizeBytes);
  const groups = bestFitPack(expanded, maxSizeBytes);
  const total = groups.length;

  for (let index = 0; index < total; index += 1) {
    const group = groups[index];
    const zipName = `stems-${String(index + 1).padStart(2, '0')}`;
    onProgress({
      state: 'packing',
      current: index,
      total,
      percent: total === 0 ? 0 : Math.floor((index / total) * 100),
      message: 'packing',
      currentZip: zipName
    });
    await createZip(zipName, group.map((file) => file.path), folderPath);
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
