import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { resolve7zBinary } from './binaries';
import { createMetadataEntries, STAMP_FILENAME } from './metadata';
import { expandFiles } from './expandFiles';
import type { PackStrategy } from './types';

function clampVolumeSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }
  return Math.max(10, Math.floor(value));
}

function parseProgressLine(line: string): number | null {
  const match = line.match(/(\d+)%/);
  if (!match) {
    return null;
  }
  const percent = Number.parseInt(match[1], 10);
  if (Number.isNaN(percent)) {
    return null;
  }
  return Math.max(0, Math.min(percent, 100));
}

async function writeExtras(
  outputDir: string,
  entries: { name: string; content: string | Buffer }[],
  stamp: string
): Promise<string[]> {
  const written: string[] = [];
  const allEntries = [...entries, { name: STAMP_FILENAME, content: stamp }];
  for (const entry of allEntries) {
    const target = path.join(outputDir, entry.name);
    const data = typeof entry.content === 'string' ? Buffer.from(entry.content, 'utf-8') : entry.content;
    await fs.promises.writeFile(target, data);
    written.push(target);
  }
  return written;
}

async function cleanupExtras(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((filePath) =>
      fs.promises
        .unlink(filePath)
        .catch((error) => console.warn('Failed to remove temporary 7z extra', filePath, error))
    )
  );
}

export const sevenZSplitStrategy: PackStrategy = async (context) => {
  if (context.files.length === 0) {
    throw new Error('pack_error_no_files');
  }

  const archiveName = 'stems.7z';
  const archivePath = path.join(context.options.outputDir, archiveName);
  const maxSizeBytes = context.options.maxArchiveSizeMB * 1024 * 1024;
  const splitThresholdBytes = context.options.splitStereoThresholdMB
    ? context.options.splitStereoThresholdMB * 1024 * 1024
    : undefined;
  const expanded = await expandFiles(context.files, {
    maxSizeBytes,
    splitThresholdBytes,
    progress: context.progress,
    emitToast: context.emitToast,
    registerTempFile: context.registerTempFile
  });

  const packedAt = new Date().toISOString();
  const { extras, stamp } = createMetadataEntries(context.options.metadata, context.options.locale, packedAt);
  const writtenExtras = await writeExtras(context.options.outputDir, [...context.extras, ...extras], stamp);

  const filesToPack = [...expanded.map((file) => path.basename(file.path)), ...writtenExtras.map((filePath) => path.basename(filePath))];
  const volumeSize = clampVolumeSize(context.options.maxArchiveSizeMB);
  const args = [
    'a',
    '-t7z',
    '-mx=5',
    '-mmt=on',
    '-bd',
    '-bsp1',
    `-v${volumeSize}m`,
    archivePath,
    ...filesToPack
  ];

  context.progress.start({ total: 1, message: 'pack_progress_preparing' });
  context.progress.tick({ state: 'preparing', percent: 100 });
  context.progress.tick({ state: 'packing', percent: 0, currentArchive: archiveName });

  let stdoutBuffer = '';

  try {
    const binary = resolve7zBinary();
    const subprocess = execa(binary, args, { cwd: context.options.outputDir });
    if (subprocess.stdout) {
      subprocess.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const percent = parseProgressLine(line);
          if (percent !== null) {
            context.progress.tick({ state: 'packing', percent, currentArchive: archiveName });
          }
        }
      });
    }

    const result = await subprocess;
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'error_7z_spawn_failed');
    }
  } catch (error) {
    context.progress.error({
      error: error instanceof Error ? error : String(error),
      message: 'pack_progress_error'
    });
    await cleanupExtras(writtenExtras);
    if (error instanceof Error && error.message === 'error_7z_binary_missing') {
      throw error;
    }
    throw new Error('error_7z_spawn_failed');
  }

  await cleanupExtras(writtenExtras);

  context.progress.fileDone({ currentArchive: archiveName, message: 'pack_progress_packing' });
  context.progress.tick({ state: 'finalizing', percent: 100, currentArchive: archiveName });
  context.progress.done({ message: 'pack_progress_done' });

  const directoryEntries = await fs.promises.readdir(context.options.outputDir, { withFileTypes: true });
  const archives = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.startsWith('stems.7z'))
    .map((entry) => path.join(context.options.outputDir, entry.name));

  return { archives };
};
