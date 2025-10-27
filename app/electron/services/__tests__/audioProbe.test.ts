import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesPerSample, isWavPcm, numChannels, probeAudio } from '../audioProbe';

const MP3_HEADER = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

async function writeTempFile(dir: string, name: string, contents: Buffer): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, contents);
  return filePath;
}

function createMinimalWav({
  audioFormat,
  channels,
  sampleRate,
  bitsPerSample,
  frames
}: {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  frames: number;
}): Buffer {
  const bytesPerSample = Math.ceil(bitsPerSample / 8);
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(audioFormat, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  // leave data section zeroed
  return buffer;
}

describe('audioProbe', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-probe-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses stereo PCM WAV metadata', async () => {
    const wavBuffer = createMinimalWav({
      audioFormat: 1,
      channels: 2,
      sampleRate: 48_000,
      bitsPerSample: 24,
      frames: 48_000
    });
    const filePath = await writeTempFile(tempDir, 'stereo.wav', wavBuffer);

    const result = await probeAudio(filePath);

    expect(result.codec).toBe('wav_pcm');
    expect(result.num_channels).toBe(2);
    expect(result.sample_rate).toBe(48_000);
    expect(result.bit_depth).toBe(24);
    expect(result.header_bytes).toBe(44);
    expect(result.data_offset).toBe(44);
    expect(result.size_bytes).toBe(wavBuffer.length);
    expect(isWavPcm(result)).toBe(true);
    expect(numChannels(result)).toBe(2);
    expect(bytesPerSample(result)).toBe(3);
  });

  it('classifies IEEE float WAV files as wav_float', async () => {
    const wavBuffer = createMinimalWav({
      audioFormat: 3,
      channels: 2,
      sampleRate: 44_100,
      bitsPerSample: 32,
      frames: 44_100
    });
    const filePath = await writeTempFile(tempDir, 'float.wav', wavBuffer);

    const result = await probeAudio(filePath);

    expect(result.codec).toBe('wav_float');
    expect(result.num_channels).toBe(2);
    expect(result.bit_depth).toBe(32);
    expect(isWavPcm(result)).toBe(false);
  });

  it('detects MP3 frame sync headers', async () => {
    const filePath = await writeTempFile(tempDir, 'track.mp3', MP3_HEADER);

    const result = await probeAudio(filePath);

    expect(result.codec).toBe('mp3');
    expect(result.num_channels).toBeUndefined();
  });

  it('falls back to extension-derived codec when probing fails', async () => {
    const filePath = await writeTempFile(tempDir, 'mystery.aac', Buffer.alloc(4));

    const result = await probeAudio(filePath);

    expect(result.codec).toBe('aac');
    expect(result.size_bytes).toBe(4);
  });
});
