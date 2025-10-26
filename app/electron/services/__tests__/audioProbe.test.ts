import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('wavefile', () => ({
  WaveFile: vi.fn()
}));

import { WaveFile } from 'wavefile';
import { probeAudio } from '../audioProbe';

const waveFileMock = WaveFile as unknown as Mock;

async function createTempFile(dir: string, name: string, contents: Buffer): Promise<string> {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, contents);
  return filePath;
}

describe('probeAudio', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-probe-'));
  });

  afterEach(async () => {
    waveFileMock.mockReset();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects stereo WAV files', async () => {
    waveFileMock.mockImplementation(() => ({ fmt: { numChannels: 2 } }));
    const header = Buffer.alloc(16);
    header.write('RIFF', 0, 'ascii');
    header.write('WAVE', 8, 'ascii');
    const filePath = await createTempFile(tempDir, 'stereo.wav', header);

    const result = await probeAudio(filePath);

    expect(result).toEqual({ kind: 'wav', stereo: true });
    expect(waveFileMock).toHaveBeenCalledTimes(1);
  });

  it('detects mono WAV files', async () => {
    waveFileMock.mockImplementation(() => ({ fmt: { numChannels: 1 } }));
    const header = Buffer.alloc(16);
    header.write('RIFF', 0, 'ascii');
    header.write('WAVE', 8, 'ascii');
    const filePath = await createTempFile(tempDir, 'mono.wav', header);

    const result = await probeAudio(filePath);

    expect(result).toEqual({ kind: 'wav', stereo: false });
  });

  it('detects MP3 files via ID3 header', async () => {
    waveFileMock.mockImplementation(() => {
      throw new Error('WaveFile should not be constructed for MP3 probe');
    });
    const header = Buffer.alloc(12);
    header.write('ID3', 0, 'ascii');
    const filePath = await createTempFile(tempDir, 'track.mp3', header);

    const result = await probeAudio(filePath);

    expect(result).toEqual({ kind: 'mp3' });
    expect(waveFileMock).not.toHaveBeenCalled();
  });

  it('detects MP3 frame sync signatures', async () => {
    waveFileMock.mockImplementation(() => {
      throw new Error('WaveFile should not be constructed for MP3 probe');
    });
    const header = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const filePath = await createTempFile(tempDir, 'frame.mp3', header);

    const result = await probeAudio(filePath);

    expect(result).toEqual({ kind: 'mp3' });
    expect(waveFileMock).not.toHaveBeenCalled();
  });

  it('classifies unknown formats as other', async () => {
    waveFileMock.mockImplementation(() => {
      throw new Error('WaveFile should not be constructed for other probes');
    });
    const header = Buffer.alloc(12);
    const filePath = await createTempFile(tempDir, 'mystery.bin', header);

    const result = await probeAudio(filePath);

    expect(result).toEqual({ kind: 'other' });
    expect(waveFileMock).not.toHaveBeenCalled();
  });
});
