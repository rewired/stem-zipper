import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../binaries', () => ({
  resolve7zBinary: vi.fn()
}));

import { parseProgressLine, run7zWithProgress } from '../sevenZStrategy';

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

import { spawn as spawnMock } from 'node:child_process';

const spawn = vi.mocked(spawnMock);

function createMockChildProcess(): {
  child: ChildProcessWithoutNullStreams;
  stdout: PassThrough;
  stderr: PassThrough;
} {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdout,
    stderr,
    stdin,
    pid: 4321,
    kill: vi.fn()
  });
  return { child, stdout, stderr };
}

afterEach(() => {
  spawn.mockReset();
  vi.useRealTimers();
});

describe('parseProgressLine', () => {
  it('parses percentages with whitespace and carriage returns', () => {
    expect(parseProgressLine(' 12%')).toBe(12);
    expect(parseProgressLine('99%\r')).toBe(99);
    expect(parseProgressLine('  7% ')).toBe(7);
  });

  it('clamps values between 0 and 100', () => {
    expect(parseProgressLine('150%')).toBe(100);
    expect(parseProgressLine('001%')).toBe(1);
  });

  it('returns null when no percentage is present', () => {
    expect(parseProgressLine('no progress')).toBeNull();
  });
});

describe('run7zWithProgress', () => {
  it('emits progress for stdout and stderr lines', async () => {
    const percents: number[] = [];
    spawn.mockImplementation(() => {
      const { child, stdout, stderr } = createMockChildProcess();
      setTimeout(() => {
        stdout.write(' 10%\r');
        stderr.write(' 55%\r');
        stdout.end();
        stderr.end();
        child.emit('close', 0);
      }, 10);
      return child;
    });

    await run7zWithProgress('/bin/7zz', ['a'], {
      cwd: '/tmp',
      onPercent: (value) => {
        percents.push(value);
      }
    });

    expect(percents).toEqual([10, 55]);
    expect(spawn).toHaveBeenCalledWith('/bin/7zz', ['a'], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  });

  it('re-emits the last percent when output stalls', async () => {
    vi.useFakeTimers();
    const percents: number[] = [];
    spawn.mockImplementation(() => {
      const { child, stdout, stderr } = createMockChildProcess();
      setTimeout(() => {
        stdout.write(' 66%\r');
        stdout.end();
        stderr.end();
      }, 10);
      setTimeout(() => {
        child.emit('close', 0);
      }, 6000);
      return child;
    });

    const runPromise = run7zWithProgress('/bin/7zz', ['a'], {
      cwd: '/tmp',
      onPercent: (value) => {
        percents.push(value);
      }
    });

    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    expect(percents).toEqual([66]);

    await vi.advanceTimersByTimeAsync(2100);
    await Promise.resolve();
    expect(percents).toEqual([66, 66]);

    await vi.advanceTimersByTimeAsync(4000);
    await runPromise;
  });

  it('rejects with a descriptive error when the process fails', async () => {
    spawn.mockImplementation(() => {
      const { child, stdout, stderr } = createMockChildProcess();
      setTimeout(() => {
        stderr.write('fatal: archive failure');
        stdout.end();
        stderr.end();
        child.emit('close', 2);
      }, 10);
      return child;
    });

    await expect(
      run7zWithProgress('/bin/7zz', ['a'], {
        cwd: '/tmp',
        onPercent: () => {}
      })
    ).rejects.toThrow('fatal: archive failure');
  });
});
