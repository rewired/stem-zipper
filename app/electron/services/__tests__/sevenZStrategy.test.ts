import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sevenZSplitStrategy } from '../pack/sevenZStrategy';
import { normalizePackMetadata } from '../packMetadata';
import type { PackStrategyContext, ProgressEvent, SizedFile } from '../pack/types';
import { createProgressReporter } from '../pack/progress';

vi.mock('../pack/binaries', () => ({
  resolve7zBinary: vi.fn()
}));

vi.mock('execa', () => ({
  execa: vi.fn()
}));

import { resolve7zBinary as resolve7zBinaryMock } from '../pack/binaries';
import { execa as execaMock } from 'execa';

const resolve7zBinary = vi.mocked(resolve7zBinaryMock);
const execa = vi.mocked(execaMock);

describe('sevenZSplitStrategy', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.resetAllMocks();
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

    resolve7zBinary.mockReturnValue('/bin/7zz');
    execa.mockImplementation(() => {
      expect(fs.existsSync(staleArchive)).toBe(false);
      expect(fs.existsSync(staleVolume)).toBe(false);
      const emitter = new EventEmitter();
      const promise = (async () => {
        emitter.emit('data', Buffer.from('10%'));
        await fs.promises.writeFile(path.join(tempRoot, 'stems.7z'), Buffer.from('archive'));
        return { exitCode: 0, stderr: '' };
      })();
      Object.assign(promise, { stdout: emitter });
      return promise as unknown as ReturnType<typeof execa>;
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
    expect(execa).toHaveBeenCalledTimes(1);
    const [, args] = execa.mock.calls[0];
    expect(args).toContain('-t7z');
    expect(args).toContain('-v50m');
    expect(args).toContain('-y');
    expect(args).toContain(path.join(tempRoot, 'stems.7z'));
    expect(events.find((event) => event.state === 'packing')).toBeTruthy();
    expect(events.at(-1)?.state).toBe('done');
    expect(result.archives).toEqual([path.join(tempRoot, 'stems.7z')]);
    expect(fs.existsSync(path.join(tempRoot, '_stem-zipper.txt'))).toBe(false);
  });

  it('throws when the 7z binary cannot be resolved', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-missing-'));
    tempDirs.push(tempRoot);
    const source = path.join(tempRoot, 'beat.wav');
    await fs.promises.writeFile(source, Buffer.from('fake-wav'));

    resolve7zBinary.mockImplementation(() => {
      throw new Error('error_7z_binary_missing');
    });

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

    await expect(sevenZSplitStrategy(context)).rejects.toThrow('error_7z_binary_missing');
  });
});
