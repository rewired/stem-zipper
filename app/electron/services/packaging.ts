import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WaveFile } from 'wavefile';
import { ZipFile } from 'yazl';
import type { FileEntry, PackProgress, PackStatusEvent, PackToast, RendererFileAction } from '../../common/ipc';
import type { EstimateFileKind } from '../../common/packing/estimator';
import { SUPPORTED_EXTENSIONS } from '../../common/constants';
import { formatPathForDisplay } from '../../common/paths';
import { formatMessage, type LocaleKey } from '../../common/i18n';
import { APP_VERSION } from '../../common/version';
import {
  appendMetadataSection,
  createAttributionText,
  createLicenseText,
  createPackMetadataJson,
  type NormalizedPackMetadata
} from './packMetadata';
import { probeAudio } from './audioProbe';

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

type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface SizedFile {
  path: string;
  size: number;
  extension: SupportedExtension;
}

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

const WAV_FORMAT_PCM = 1;
const WAV_FORMAT_IEEE_FLOAT = 3;

export class UnsupportedWavError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedWavError';
  }
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

function isLikelyStereoWav(file: SizedFile): boolean {
  let handle: number | undefined;
  try {
    handle = fs.openSync(file.path, 'r');
    const riffHeader = Buffer.alloc(12);
    const riffRead = fs.readSync(handle, riffHeader, 0, 12, 0);
    if (riffRead < 12) {
      return false;
    }
    if (riffHeader.toString('ascii', 0, 4) !== 'RIFF' || riffHeader.toString('ascii', 8, 12) !== 'WAVE') {
      return false;
    }

    let offset = 12;
    const chunkHeader = Buffer.alloc(8);

    while (offset + 8 <= file.size) {
      const headerRead = fs.readSync(handle, chunkHeader, 0, 8, offset);
      if (headerRead < 8) {
        break;
      }
      const chunkId = chunkHeader.toString('ascii', 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      if (chunkId === 'fmt ') {
        const fmtBuffer = Buffer.alloc(4);
        const fmtRead = fs.readSync(handle, fmtBuffer, 0, 4, offset + 8);
        if (fmtRead < 4) {
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
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch (closeError) {
        console.warn('Failed to close WAV handle after inspection', file.path, closeError);
      }
    }
  }
  return false;
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

function sniffFileKind(file: SizedFile): EstimateFileKind {
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
  const entries: FileEntry[] = sizedFiles.map((file) => {
    const action = resolveAction(file.size, file.extension, maxSizeBytes);
    const shouldInspectStereo = file.extension === '.wav' && file.size > maxSizeBytes;
    const stereo = shouldInspectStereo && isLikelyStereoWav(file) ? true : undefined;
    const kind = sniffFileKind(file);
    return {
      name: path.basename(file.path),
      sizeMb: toMb(file.size),
      action,
      path: file.path,
      sizeBytes: file.size,
      kind,
      stereo
    };
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

interface ZipTextEntry {
  name: string;
  content: string | Buffer;
  compress?: boolean;
}

interface CreateBrandedZipOptions {
  extras?: ZipTextEntry[];
  stampContent?: string;
}

export async function createBrandedZip(
  zipName: string,
  files: SizedFile[],
  outDir: string,
  options: CreateBrandedZipOptions = {}
): Promise<string> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${zipName}.zip`);
  const zip = new ZipFile();

  for (const file of files) {
    zip.addFile(file.path, path.basename(file.path));
  }
  const stamp = options.stampContent ?? STEM_ZIPPER_STAMP;
  zip.addBuffer(Buffer.from(stamp, 'utf-8'), STAMP_FILENAME, { compress: false });

  if (options.extras) {
    for (const entry of options.extras) {
      const buffer = typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf-8') : entry.content;
      zip.addBuffer(buffer, entry.name, { compress: entry.compress ?? false });
    }
  }

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

export async function splitStereoWav(filePath: string): Promise<SizedFile[]> {
  const buffer = await fs.promises.readFile(filePath);
  const wav = new WaveFile(buffer);
  const fmt = wav.fmt as { audioFormat?: number; numChannels?: number; sampleRate?: number } | undefined;
  const numChannels = fmt?.numChannels;
  const audioFormat = fmt?.audioFormat;

  if (numChannels !== 2) {
    throw new UnsupportedWavError(`Expected stereo WAV but found channels=${numChannels ?? 'unknown'}`);
  }

  if (audioFormat !== WAV_FORMAT_PCM && audioFormat !== WAV_FORMAT_IEEE_FLOAT) {
    throw new UnsupportedWavError(`Unsupported WAV audio format: ${audioFormat ?? 'unknown'}`);
  }

  const sampler = (wav as unknown as {
    getSamples?: (interleaved: false, OutputObject: { new (...args: unknown[]): Float64Array }) => Float64Array[];
  }).getSamples;

  if (typeof sampler !== 'function') {
    throw new UnsupportedWavError('WaveFile#getSamples is not available');
  }

  const channels = sampler.call(wav, false, Float64Array);

  if (!Array.isArray(channels) || channels.length < 2) {
    throw new UnsupportedWavError('WaveFile#getSamples did not return stereo channels');
  }

  const [leftSamples, rightSamples] = channels;
  if (!leftSamples || !rightSamples) {
    throw new UnsupportedWavError('Stereo channels are missing sample data');
  }

  const sampleRate = fmt?.sampleRate ?? 44100;
  const bitDepthCode = (typeof wav.bitDepth === 'string' && wav.bitDepth) || '16';
  const { dir, name, ext } = path.parse(filePath);
  const leftPath = path.join(dir, `${name}_L${ext}`);
  const rightPath = path.join(dir, `${name}_R${ext}`);
  const created: string[] = [];

  try {
    const left = new WaveFile();
    left.fromScratch(1, sampleRate, bitDepthCode, [leftSamples]);
    await fs.promises.writeFile(leftPath, left.toBuffer());
    created.push(leftPath);

    const right = new WaveFile();
    right.fromScratch(1, sampleRate, bitDepthCode, [rightSamples]);
    await fs.promises.writeFile(rightPath, right.toBuffer());
    created.push(rightPath);

    await fs.promises.unlink(filePath);
  } catch (error) {
    await Promise.all(
      created.map((outputPath) =>
        fs.promises
          .unlink(outputPath)
          .catch((unlinkError) =>
            console.warn('Failed to clean up partial WAV split output', outputPath, unlinkError)
          )
      )
    );
    throw error;
  }

  return Promise.all([getSizedFile(leftPath), getSizedFile(rightPath)]);
}

interface ExpandFilesOptions {
  maxSizeBytes: number;
  onProgress?: (progress: PackProgress) => void;
  emitToast?: (toast: PackToast) => void;
  splitter?: (filePath: string) => Promise<SizedFile[]>;
}

export async function expandFiles(files: SizedFile[], options: ExpandFilesOptions): Promise<SizedFile[]> {
  const expanded: SizedFile[] = [];
  const toSplit = files.filter((f) => f.size > options.maxSizeBytes && f.extension === '.wav').length;
  let processed = 0;
  const performSplit = options.splitter ?? splitStereoWav;

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
    console.warn('Skipping file due to split failure', { file: file.path, error: message });
    options.emitToast?.({
      id: `split-error:${file.path}`,
      level: 'warning',
      messageKey: 'pack_warn_file_skipped',
      params: { file: formatPathForDisplay(file.path) }
    });
  };

  for (const file of files) {
    if (file.size > options.maxSizeBytes && file.extension === '.wav') {
      try {
        const probe = await probeAudio(file.path);
        if (probe.kind !== 'wav') {
          notifySkip(file, `probe-kind=${probe.kind}`);
          expanded.push(file);
        } else if (probe.stereo !== true) {
          notifySkip(file, `stereo=${probe.stereo ?? 'unknown'}`);
          expanded.push(file);
        } else {
          const split = await performSplit(file.path);
          expanded.push(...split);
        }
      } catch (error) {
        if (error instanceof UnsupportedWavError) {
          notifySkip(file, error.message);
          expanded.push(file);
        } else {
          notifyError(file, error);
        }
      } finally {
        processed += 1;
        if (options.onProgress && toSplit > 0) {
          options.onProgress({
            state: 'analyzing',
            current: processed,
            total: toSplit,
            percent: Math.floor((processed / toSplit) * 100),
            message: 'splitting'
          });
        }
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
  metadata: NormalizedPackMetadata,
  onProgress: (progress: PackProgress) => void,
  onStatus?: (status: PackStatusEvent) => void
): Promise<number> {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  const sizedFiles = scanTargetFolder(folderPath);
  if (sizedFiles.length === 0) {
    const noFilesMessage = formatMessage(locale, 'pack_status_no_files');
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
    const expanded = await expandFiles(filesForExtension, {
      maxSizeBytes,
      onProgress,
      emitToast: onStatus
        ? (toast: PackToast) => {
            onStatus({ type: 'toast', toast });
          }
        : undefined
    });
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
    const packedAt = new Date().toISOString();
    const extras = [
      { name: 'PACK-METADATA.json', content: createPackMetadataJson(metadata) },
      { name: 'LICENSE.txt', content: createLicenseText(metadata) },
      { name: 'ATTRIBUTION.txt', content: createAttributionText(metadata) }
    ];
    const stampContent = appendMetadataSection(STEM_ZIPPER_STAMP, metadata, locale, packedAt);
    await createBrandedZip(zipName, group, folderPath, { extras, stampContent });
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


