import fs from 'node:fs';
import path from 'node:path';
import { resolve7zBinary } from './binaries';
import { createMetadataEntries, STAMP_FILENAME } from './metadata';
import { expandFiles } from './expandFiles';
import type { PackStrategy, SizedFile } from './types';

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

async function removeExistingArchives(outputDir: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(outputDir, { withFileTypes: true });
    const staleArchives = entries.filter(
      (entry) => entry.isFile() && /^stems\.7z(\.\d{3})?$/i.test(entry.name)
    );
    await Promise.all(
      staleArchives.map((entry) =>
        fs.promises
          .unlink(path.join(outputDir, entry.name))
          .catch((error) =>
            console.warn('Failed to remove existing 7z archive before packing', entry.name, error)
          )
      )
    );
  } catch (error) {
    console.warn('Failed to scan for existing 7z archives before packing', outputDir, error);
  }
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

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
}

async function stageFileForArchive(
  file: SizedFile,
  outputDir: string,
  registerTempFile: (filePath: string) => void
): Promise<string> {
  const baseName = path.basename(file.path);
  if (path.dirname(file.path) === outputDir) {
    return baseName;
  }

  const targetPath = path.join(outputDir, baseName);
  const targetExists = await fs.promises
    .access(targetPath)
    .then(() => true)
    .catch(() => false);

  if (targetExists) {
    console.warn('Refusing to overwrite existing file while staging for 7z', targetPath);
    throw new Error('error_7z_spawn_failed');
  }

  try {
    await fs.promises.rename(file.path, targetPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EXDEV') {
      await fs.promises.copyFile(file.path, targetPath, fs.constants.COPYFILE_EXCL);
      await fs.promises.unlink(file.path).catch((unlinkError) => {
        if (isErrnoException(unlinkError) && unlinkError.code !== 'ENOENT') {
          console.warn('Failed to remove staged source after copy', file.path, unlinkError);
        }
      });
    } else {
      throw error;
    }
  }

  registerTempFile(targetPath);
  return path.basename(targetPath);
}

async function stageFilesForArchive(
  files: SizedFile[],
  outputDir: string,
  registerTempFile: (filePath: string) => void
): Promise<string[]> {
  const staged: string[] = [];
  for (const file of files) {
    const stagedName = await stageFileForArchive(file, outputDir, registerTempFile);
    staged.push(stagedName);
  }
  return staged;
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
  await removeExistingArchives(context.options.outputDir);
  const writtenExtras = await writeExtras(context.options.outputDir, [...context.extras, ...extras], stamp);

  const volumeSize = clampVolumeSize(context.options.maxArchiveSizeMB);

  context.progress.start({ total: 1, message: 'pack_progress_preparing' });
  context.progress.tick({ state: 'preparing', percent: 100 });
  context.progress.tick({ state: 'packing', percent: 0, currentArchive: archiveName });

  let stdoutBuffer = '';

  try {
    const binary = resolve7zBinary();
    const stagedFiles = await stageFilesForArchive(
      expanded,
      context.options.outputDir,
      context.registerTempFile
    );
    const filesToPack = [
      ...stagedFiles,
      ...writtenExtras.map((filePath) => path.basename(filePath))
    ];
    const args = [
      'a',
      '-t7z',
      '-mx=5',
      '-mmt=on',
      '-bd',
      '-bsp1',
      '-y',
      `-v${volumeSize}m`,
      archivePath,
      ...filesToPack
    ];
    const { execa } = await import('execa');
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
