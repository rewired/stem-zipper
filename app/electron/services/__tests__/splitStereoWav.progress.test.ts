import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgressReporter } from '../pack/progress';
import { expandFiles } from '../pack/expandFiles';
import { splitStereoWav } from '../pack/splitStereo';
import type { SplitStereoWavOptions } from '../pack/splitStereo';
import type { ProgressEvent, SizedFile } from '../pack/types';
import * as audioProbeModule from '../audioProbe';

function makeSizedFile(filePath: string, size: number): SizedFile {
  return { path: filePath, size, extension: '.wav' };
}

function createStereoWavBuffer(frames: number, sampleRate: number, bitsPerSample: number): Buffer {
  const bytesPerSample = Math.ceil(bitsPerSample / 8);
  const blockAlign = bytesPerSample * 2;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let index = 0; index < frames; index += 1) {
    const value = index % 256;
    buffer.writeInt16LE(value, offset);
    buffer.writeInt16LE(255 - value, offset + bytesPerSample);
    offset += blockAlign;
  }
  return buffer;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('splitStereoWav progress integration', () => {
  it('tracks predicted totals when splits are known ahead of time', async () => {
    const files: SizedFile[] = Array.from({ length: 10 }, (_, index) =>
      makeSizedFile(`/audio/file-${index}.wav`, index < 3 ? 2_000_000 : 500_000)
    );

    vi.spyOn(audioProbeModule, 'probeAudio').mockResolvedValue({
      codec: 'wav_pcm',
      num_channels: 2,
      size_bytes: 0,
      ext: '.wav',
      path: files[0]?.path
    });

    const splitter = vi.fn<
      [filePath: string, options?: SplitStereoWavOptions],
      Promise<SizedFile[]>
    >(async (filePath: string) => {
      const base = path.basename(filePath, '.wav');
      return [
        { path: `/tmp/${base}-L.wav`, size: 1_000_000, extension: '.wav' },
        { path: `/tmp/${base}-R.wav`, size: 1_000_000, extension: '.wav' }
      ] satisfies SizedFile[];
    });

    const events: ProgressEvent[] = [];
    const reporter = createProgressReporter((event) => events.push(event));

    const expanded = await expandFiles(files, {
      maxSizeBytes: 1_000_000,
      progress: reporter,
      splitter
    });

    expect(expanded).toHaveLength(13);
    const lastEvent = events.at(-1);
    expect(lastEvent?.state).toBe('preparing');
    expect(lastEvent?.total).toBe(13);
    expect(lastEvent?.current).toBe(13);
    expect(lastEvent?.percent).toBe(100);
  });

  it('adjusts totals on the fly when splits create additional files', async () => {
    const file = makeSizedFile('/audio/oversplit.wav', 2_000_000);

    vi.spyOn(audioProbeModule, 'probeAudio').mockResolvedValue({
      codec: 'wav_pcm',
      num_channels: 2,
      size_bytes: file.size,
      ext: '.wav',
      path: file.path
    });

    const splitter = vi.fn<
      [filePath: string, options?: SplitStereoWavOptions],
      Promise<SizedFile[]>
    >(async () =>
      [
        { path: '/tmp/oversplit-L.wav', size: 800_000, extension: '.wav' },
        { path: '/tmp/oversplit-M.wav', size: 800_000, extension: '.wav' },
        { path: '/tmp/oversplit-R.wav', size: 800_000, extension: '.wav' }
      ] satisfies SizedFile[]
    );

    const events: ProgressEvent[] = [];
    const reporter = createProgressReporter((event) => events.push(event));

    await expandFiles([file], {
      maxSizeBytes: 1_000_000,
      progress: reporter,
      splitter
    });

    const preparingPercents = events
      .filter((event) => event.state === 'preparing')
      .map((event) => event.percent);
    expect(preparingPercents.length).toBeGreaterThan(0);
    for (let index = 1; index < preparingPercents.length; index += 1) {
      expect(preparingPercents[index]).toBeGreaterThanOrEqual(preparingPercents[index - 1]);
    }
    const lastPercent = preparingPercents.at(-1);
    expect(lastPercent).toBe(100);
    expect(Math.max(...preparingPercents)).toBeLessThanOrEqual(100);
    const lastEvent = events.at(-1);
    expect(lastEvent?.total).toBe(3);
    expect(lastEvent?.current).toBe(3);
  });

  it('emits progress ticks during long split operations', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'split-progress-'));
    const wavPath = path.join(tempRoot, 'fixture.wav');
    await fs.promises.writeFile(wavPath, createStereoWavBuffer(32_768, 44_100, 16));

    const artifacts = new Set<string>();
    const fractions: number[] = [];

    try {
      const outputs = await splitStereoWav(wavPath, {
        registerTemp: (artifact) => artifacts.add(artifact),
        onProgress: (fraction) => fractions.push(fraction)
      });

      for (const entry of outputs) {
        artifacts.add(entry.path);
      }

      expect(fractions.length).toBeGreaterThan(1);
      expect(fractions.at(-1)).toBe(1);
      expect(fractions.some((value) => value > 0 && value < 1)).toBe(true);
    } finally {
      for (const artifact of Array.from(artifacts).sort((a, b) => b.length - a.length)) {
        await fs.promises.rm(artifact, { recursive: true, force: true });
      }
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
