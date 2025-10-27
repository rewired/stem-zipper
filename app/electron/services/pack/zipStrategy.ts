import fs from 'node:fs';
import path from 'node:path';
import { ZipFile } from 'yazl';
import { createMetadataEntries, STAMP_FILENAME } from './metadata';
import {
  bestFitPack,
  expandFiles,
  groupFilesByExtension,
  sniffFileKind,
  toMb
} from './expandFiles';
import type { PackStrategy, PackStrategyContext, SizedFile, StrategyResult } from './types';

async function createBrandedZip(
  zipName: string,
  files: SizedFile[],
  outDir: string,
  extras: PackStrategyContext['extras'],
  stamp: string
): Promise<string> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${zipName}.zip`);
  const zip = new ZipFile();

  for (const file of files) {
    zip.addFile(file.path, path.basename(file.path));
  }

  zip.addBuffer(Buffer.from(stamp, 'utf-8'), STAMP_FILENAME, { compress: false });

  for (const entry of extras) {
    const buffer = typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf-8') : entry.content;
    zip.addBuffer(buffer, entry.name, { compress: entry.compress ?? false });
  }

  return new Promise((resolve, reject) => {
    zip
      .outputStream.pipe(fs.createWriteStream(zipPath))
      .on('close', () => resolve(zipPath))
      .on('error', reject);
    zip.end();
  });
}

function ensureFilesAvailable(files: SizedFile[]): void {
  if (files.length === 0) {
    throw new Error('pack_error_no_files');
  }
}

async function collectGroups(context: PackStrategyContext): Promise<SizedFile[][]> {
  const { files, options, progress, emitToast } = context;
  const maxSizeBytes = options.maxArchiveSizeMB * 1024 * 1024;
  const splitThresholdBytes = options.splitStereoThresholdMB
    ? options.splitStereoThresholdMB * 1024 * 1024
    : undefined;
  const grouped = groupFilesByExtension(files);
  const orderedExtensions = Array.from(grouped.keys()).sort();
  const collections: SizedFile[][] = [];
  const forcedSplitSet = options.splitStereoFiles ? new Set(options.splitStereoFiles) : undefined;

  for (const extension of orderedExtensions) {
    const filesForExtension = grouped.get(extension);
    if (!filesForExtension || filesForExtension.length === 0) continue;
    const expanded = await expandFiles(filesForExtension, {
      maxSizeBytes,
      splitThresholdBytes,
      progress,
      emitToast,
      registerTempFile: context.registerTempFile,
      forceSplit: forcedSplitSet
    });
    const packed = bestFitPack(expanded, maxSizeBytes);
    collections.push(...packed);
  }

  return collections;
}

async function runZipStrategy(context: PackStrategyContext): Promise<StrategyResult> {
  ensureFilesAvailable(context.files);

  const groups = await collectGroups(context);
  const total = groups.length;
  context.progress.start({ total, message: 'pack_progress_preparing' });

  const archives: string[] = [];

  for (let index = 0; index < total; index += 1) {
    const group = groups[index];
    const zipName = `stems-${String(index + 1).padStart(2, '0')}`;
    context.progress.tick({ state: 'packing', percent: total === 0 ? 0 : Math.floor((index / total) * 100), currentArchive: zipName });
    const packedAt = new Date().toISOString();
    const { extras, stamp } = createMetadataEntries(context.options.metadata, context.options.locale, packedAt);
    const archivePath = await createBrandedZip(zipName, group, context.options.outputDir, [...context.extras, ...extras], stamp);
    archives.push(archivePath);
    context.progress.fileDone({ currentArchive: zipName, message: 'pack_progress_packing' });
  }

  context.progress.done({ message: 'pack_progress_done' });
  return { archives };
}

export const zipBestFitStrategy: PackStrategy = (context) => runZipStrategy(context);

export function describeSizedFile(file: SizedFile): string {
  return `${path.basename(file.path)} (${toMb(file.size)} MB, ${sniffFileKind(file)})`;
}
