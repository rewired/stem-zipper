import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { splitStereoWav } from '../pack/splitStereo';

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

describe('splitStereoWav backpressure handling', () => {
  const artifacts = new Set<string>();
  let tempDir = '';

  afterEach(async () => {
    vi.restoreAllMocks();
    const cleanupTargets = Array.from(artifacts).sort((a, b) => b.length - a.length);
    artifacts.clear();
    for (const target of cleanupTargets) {
      await fs.promises.rm(target, { recursive: true, force: true });
    }
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('only attaches a single drain listener per write stream while splitting', async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'split-backpressure-'));
    const wavPath = path.join(tempDir, 'fixture.wav');
    artifacts.add(wavPath);
    await fs.promises.writeFile(wavPath, createStereoWavBuffer(4096, 44_100, 16));

    const originalCreateWriteStream = fs.createWriteStream;
    type CreateWriteStreamParams = Parameters<typeof originalCreateWriteStream>;
    const maxDrainListeners = new Map<string, number>();

    const createSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation((target, options) => {
      const stream = originalCreateWriteStream(
        target as CreateWriteStreamParams[0],
        options as CreateWriteStreamParams[1]
      );
      let maxListeners = 0;

      const updateMaxListeners = () => {
        const current = stream.listenerCount('drain');
        if (current > maxListeners) {
          maxListeners = current;
        }
      };

      const wrapListenerMethod = <K extends 'on' | 'once' | 'addListener'>(method: K) => {
        const original = (stream[method] as unknown as (event: string, listener: (...args: unknown[]) => void) => fs.WriteStream).bind(stream);
        return ((event: string, listener: (...args: unknown[]) => void) => {
          const result = original(event, listener);
          if (event === 'drain') {
            updateMaxListeners();
          }
          return result;
        }) as typeof stream[typeof method];
      };

      stream.on = wrapListenerMethod('on');
      stream.once = wrapListenerMethod('once');
      stream.addListener = wrapListenerMethod('addListener');

      const originalWrite = stream.write.bind(stream);
      type WriteArgs = Parameters<typeof originalWrite>;
      let shouldBackpressure = true;
      stream.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
        const outcome = originalWrite(
          chunk as WriteArgs[0],
          encoding as WriteArgs[1],
          callback as WriteArgs[2]
        );
        if (shouldBackpressure) {
          shouldBackpressure = false;
          setImmediate(() => {
            shouldBackpressure = true;
            stream.emit('drain');
          });
          return false;
        }
        return outcome;
      }) as typeof stream.write;

      const key = String(target);
      stream.on('close', () => {
        maxDrainListeners.set(key, maxListeners);
      });

      return stream;
    });

    try {
      const outputs = await splitStereoWav(wavPath);
      for (const file of outputs) {
        artifacts.add(file.path);
      }
      if (outputs.length > 0) {
        artifacts.add(path.dirname(outputs[0].path));
      }
    } finally {
      createSpy.mockRestore();
    }

    expect(maxDrainListeners.size).toBeGreaterThan(0);
    for (const max of maxDrainListeners.values()) {
      expect(max).toBeLessThanOrEqual(1);
    }
  });
});
