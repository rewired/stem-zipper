import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sevenZSplitStrategy } from '../pack/sevenZStrategy';
import { normalizePackMetadata } from '../packMetadata';
import type { PackStrategyContext, ProgressEvent, SizedFile } from '../pack/types';
import { createProgressReporter } from '../pack/progress';

vi.mock('../pack/resolve7zBinary', () => ({
  resolve7zBinary: vi.fn()
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

import { resolve7zBinary as resolve7zBinaryMock } from '../pack/resolve7zBinary';
import { spawn as spawnMock } from 'node:child_process';

const resolve7zBinary = vi.mocked(resolve7zBinaryMock);
const spawn = vi.mocked(spawnMock);

function createMockChildProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdout,
    stderr,
    stdin,
    pid: 1234,
    kill: vi.fn()
  });
  return { child, stdout, stderr };
}

describe('sevenZSplitStrategy', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.resetAllMocks();
    spawn.mockReset();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('spawns 7z with the expected arguments and emits progress', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-'));
    tempDirs.push(tempRoot);
    const source = path.join(tempRoot, 'beat.wav');
    await fs.promises.writeFile(source, Buffer.from('fake-wav'));

    const sizedFile: SizedFile = { path: source, size: 8, extension: '.wav' };
    const staleArchive = path.join(tempRoot, 'stems.7z');
    const staleVolume = path.join(tempRoot, 'stems.7z.002');
    await fs.promises.writeFile(staleArchive, Buffer.from('old-archive'));
    await fs.promises.writeFile(staleVolume, Buffer.from('old-volume'));
    const metadata = normalizePackMetadata({
      title: 'Fixture',
      artist: 'Test Artist',
      license: { id: 'CC-BY-4.0' }
    });

    const events: ProgressEvent[] = [];
    const reporter = createProgressReporter((event) => events.push(event));

    resolve7zBinary.mockResolvedValue('/bin/7zz');
    spawn.mockImplementation(() => {
      expect(fs.existsSync(staleArchive)).toBe(false);
      expect(fs.existsSync(staleVolume)).toBe(false);
      const { child, stdout, stderr } = createMockChildProcess();
      setTimeout(() => {
        stdout.write(' 10%\r');
        stdout.write(' 40%\n');
        stderr.write(' 80%\r');
        stdout.end();
        stderr.end();
        fs.writeFileSync(path.join(tempRoot, 'stems.7z'), Buffer.from('archive'));
        child.emit('close', 0);
      }, 10);
      return child;
    });

    const context: PackStrategyContext = {
      files: [sizedFile],
      options: {
        method: 'seven_z_split',
        maxArchiveSizeMB: 50,
        outputDir: tempRoot,
        files: [source],
        locale: 'en',
        metadata,
        splitStereoThresholdMB: undefined
      },
      progress: reporter,
      extras: [],
      emitToast: undefined,
      registerTempFile: () => {}
    };

    const result = await sevenZSplitStrategy(context);

    expect(resolve7zBinary).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    const [, args, spawnOptions] = spawn.mock.calls[0];
    expect(args).toContain('-t7z');
    expect(args).toContain('-v50m');
    expect(args).toContain('-y');
    expect(args).toContain(path.join(tempRoot, 'stems.7z'));
    expect(spawnOptions?.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    expect(events.find((event) => event.state === 'packing')).toBeTruthy();
    expect(events.at(-1)?.state).toBe('done');
    expect(result.archives).toEqual([path.join(tempRoot, 'stems.7z')]);
    expect(fs.existsSync(path.join(tempRoot, '_stem-zipper.txt'))).toBe(false);
  });

  it('stages split files created outside the output directory before invoking 7z', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-stage-'));
    const splitRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-split-'));
    tempDirs.push(tempRoot, splitRoot);

    const leftSource = path.join(splitRoot, 'beat-L.wav');
    const rightSource = path.join(splitRoot, 'beat-R.wav');
    await fs.promises.writeFile(leftSource, Buffer.from('left-wav'));
    await fs.promises.writeFile(rightSource, Buffer.from('right-wav'));

    const metadata = normalizePackMetadata({
      title: 'Fixture',
      artist: 'Test Artist',
      license: { id: 'CC-BY-4.0' }
    });

    resolve7zBinary.mockResolvedValue('/bin/7zz');
    const stagedPaths: string[] = [];

    spawn.mockImplementation(() => {
      expect(fs.existsSync(leftSource)).toBe(false);
      expect(fs.existsSync(rightSource)).toBe(false);
      expect(fs.existsSync(path.join(tempRoot, 'beat-L.wav'))).toBe(true);
      expect(fs.existsSync(path.join(tempRoot, 'beat-R.wav'))).toBe(true);
      const { child, stdout, stderr } = createMockChildProcess();
      setTimeout(() => {
        stdout.write(' 25%\r');
        stdout.end();
        stderr.end();
        fs.writeFileSync(path.join(tempRoot, 'stems.7z'), Buffer.from('archive'));
        child.emit('close', 0);
      }, 10);
      return child;
    });

    const context: PackStrategyContext = {
      files: [
        { path: leftSource, size: 4, extension: '.wav' },
        { path: rightSource, size: 4, extension: '.wav' }
      ],
      options: {
        method: 'seven_z_split',
        maxArchiveSizeMB: 50,
        outputDir: tempRoot,
        files: [leftSource, rightSource],
        locale: 'en',
        metadata
      },
      progress: createProgressReporter(() => {}),
      extras: [],
      emitToast: undefined,
      registerTempFile: (filePath) => {
        stagedPaths.push(filePath);
      }
    };

    const result = await sevenZSplitStrategy(context);

    expect(resolve7zBinary).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(stagedPaths).toEqual([
      path.join(tempRoot, 'beat-L.wav'),
      path.join(tempRoot, 'beat-R.wav')
    ]);
    const [, args] = spawn.mock.calls[0];
    expect(args).toContain('beat-L.wav');
    expect(args).toContain('beat-R.wav');
    expect(result.archives).toEqual([path.join(tempRoot, 'stems.7z')]);
  });

  it('throws when the 7z binary cannot be resolved', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-missing-'));
    tempDirs.push(tempRoot);
    const source = path.join(tempRoot, 'beat.wav');
    await fs.promises.writeFile(source, Buffer.from('fake-wav'));

    resolve7zBinary.mockRejectedValue(new Error('pack_error_7z_binary_missing'));

    const context: PackStrategyContext = {
      files: [{ path: source, size: 8, extension: '.wav' }],
      options: {
        method: 'seven_z_split',
        maxArchiveSizeMB: 50,
        outputDir: tempRoot,
        files: [source],
        locale: 'en',
        metadata: normalizePackMetadata({
          title: 'Missing',
          artist: 'Tester',
          license: { id: 'CC-BY-4.0' }
        })
      },
      progress: createProgressReporter(() => {}),
      extras: [],
      emitToast: undefined,
      registerTempFile: () => {}
    };

    await expect(sevenZSplitStrategy(context)).rejects.toThrow('pack_error_7z_binary_missing');
  });
});
