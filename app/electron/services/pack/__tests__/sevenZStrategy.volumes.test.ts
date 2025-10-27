import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';


vi.mock('../binaries', () => ({
  resolve7zBinary: vi.fn(() => '/bin/7zz')
}));

vi.mock('../expandFiles', () => ({
  expandFiles: vi.fn()
}));

vi.mock('../metadata', () => ({
  createMetadataEntries: vi.fn(() => ({ extras: [], stamp: 'stamp' })),
  STAMP_FILENAME: 'stamp.txt'
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  const { EventEmitter } = await vi.importActual<typeof import('node:events')>('node:events');
  const { PassThrough } = await vi.importActual<typeof import('node:stream')>('node:stream');

  const spawn = vi.fn(() => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const child = new EventEmitter() as unknown as import('node:child_process').ChildProcessWithoutNullStreams;
    Object.assign(child, {
      stdout,
      stderr,
      stdin,
      kill: vi.fn()
    });

    queueMicrotask(() => {
      stdout.end();
      stderr.end();
      child.emit('close', 0);
    });

    return child;
  });

  return {
    ...actual,
    spawn
  };
});

import fs from 'node:fs';

import { expandFiles } from '../expandFiles';
import type { PackStrategyContext } from '../types';
import * as strategyModule from '../sevenZStrategy';

const expandFilesMock = vi.mocked(expandFiles);
const run7zWithProgressMock = vi
  .spyOn(strategyModule, 'run7zWithProgress')
  .mockResolvedValue();

let readdirMock: MockedFunction<typeof fs.promises.readdir>;
let writeFileMock: MockedFunction<typeof fs.promises.writeFile>;
let renameMock: MockedFunction<typeof fs.promises.rename>;
let accessMock: MockedFunction<typeof fs.promises.access>;
let unlinkMock: MockedFunction<typeof fs.promises.unlink>;
let copyFileMock: MockedFunction<typeof fs.promises.copyFile>;

function createContext(): PackStrategyContext {
  return {
    files: [
      {
        path: '/input/drums.wav',
        size: 1024,
        extension: '.wav'
      }
    ],
    options: {
      method: 'seven_z_split',
      maxArchiveSizeMB: 100,
      outputDir: '/tmp/output',
      files: ['/input/drums.wav'],
      locale: 'en',
      metadata: {
        title: 'Song',
        artist: 'Artist',
        license: { id: 'CC0-1.0' }
      }
    },
    progress: {
      start: vi.fn(),
      tick: vi.fn(),
      fileDone: vi.fn(),
      done: vi.fn(),
      error: vi.fn()
    },
    extras: [],
    emitToast: vi.fn(),
    registerTempFile: vi.fn()
  };
}

function createDirent(name: string, isFile = true): fs.Dirent {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false
  } as unknown as fs.Dirent;
}

describe('sevenZ volumes', () => {
  beforeEach(() => {
    readdirMock = vi.spyOn(fs.promises, 'readdir');
    writeFileMock = vi.spyOn(fs.promises, 'writeFile');
    renameMock = vi.spyOn(fs.promises, 'rename');
    accessMock = vi.spyOn(fs.promises, 'access');
    unlinkMock = vi.spyOn(fs.promises, 'unlink');
    copyFileMock = vi.spyOn(fs.promises, 'copyFile');

    expandFilesMock.mockResolvedValue(createContext().files);
    run7zWithProgressMock.mockClear();
    run7zWithProgressMock.mockResolvedValue();
    accessMock.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    renameMock.mockResolvedValue();
    writeFileMock.mockResolvedValue();
    unlinkMock.mockResolvedValue();
    copyFileMock.mockResolvedValue();
  });

  afterEach(() => {
    readdirMock.mockRestore();
    writeFileMock.mockRestore();
    renameMock.mockRestore();
    accessMock.mockRestore();
    unlinkMock.mockRestore();
    copyFileMock.mockRestore();
    vi.clearAllMocks();
  });

  it('recognizes single and multi-volume archive names', () => {
    expect(strategyModule.is7zVolume('stems.7z')).toBe(true);
    expect(strategyModule.is7zVolume('stems.7z.001')).toBe(true);
    expect(strategyModule.is7zVolume('stems.7z.123')).toBe(true);
    expect(strategyModule.is7zVolume('stems.7z.tmp')).toBe(false);
    expect(strategyModule.is7zVolume('other.7z.001')).toBe(false);
  });

  it('sorts multi-volume archives numerically and filters unrelated files', async () => {
    const context = createContext();
    expandFilesMock.mockResolvedValue(context.files);
    readdirMock.mockResolvedValueOnce([]);
    readdirMock.mockResolvedValueOnce([
      createDirent('stems.7z.010'),
      createDirent('notes.txt'),
      createDirent('stems.7z.002'),
      createDirent('stems.7z.001'),
      createDirent('cover.png'),
      createDirent('stems.7z.100')
    ]);

    const result = await strategyModule.sevenZSplitStrategy(context);

    expect(result.archives).toEqual([
      path.join(context.options.outputDir, 'stems.7z.001'),
      path.join(context.options.outputDir, 'stems.7z.002'),
      path.join(context.options.outputDir, 'stems.7z.010'),
      path.join(context.options.outputDir, 'stems.7z.100')
    ]);
  });

  it('returns a single archive path when only stems.7z exists', async () => {
    const context = createContext();
    expandFilesMock.mockResolvedValue(context.files);
    readdirMock.mockResolvedValueOnce([]);
    readdirMock.mockResolvedValueOnce([createDirent('stems.7z')]);

    const result = await strategyModule.sevenZSplitStrategy(context);

    expect(result.archives).toEqual([
      path.join(context.options.outputDir, 'stems.7z')
    ]);
  });
});
