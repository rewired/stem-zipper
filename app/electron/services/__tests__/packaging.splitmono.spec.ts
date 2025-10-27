import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pack } from '../pack';

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
  // simple ramp samples
  let offset = 44;
  for (let index = 0; index < frames; index += 1) {
    const value = index % 256;
    buffer.writeInt16LE(value, offset);
    buffer.writeInt16LE(255 - value, offset + bytesPerSample);
    offset += blockAlign;
  }
  return buffer;
}

async function extractZipEntries(buffer: Buffer): Promise<string[]> {
  const entries: string[] = [];
  const signature = Buffer.from('504b0102', 'hex');
  let offset = 0;
  while (offset < buffer.length) {
    const index = buffer.indexOf(signature, offset);
    if (index === -1) {
      break;
    }
    const fileNameLength = buffer.readUInt16LE(index + 28);
    const extraLength = buffer.readUInt16LE(index + 30);
    const commentLength = buffer.readUInt16LE(index + 32);
    const nameStart = index + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = buffer.toString('utf8', nameStart, nameEnd);
    entries.push(name);
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

describe('pack split-mono integration', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('splits flagged stereo WAVs into mono files during pack', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'split-mono-pack-'));
    tempDirs.push(tempRoot);
    const wavPath = path.join(tempRoot, 'fixture.wav');
    const buffer = createStereoWavBuffer(128, 44_100, 16);
    await fs.promises.writeFile(wavPath, buffer);

    const result = await pack({
      options: {
        method: 'zip_best_fit',
        maxArchiveSizeMB: 2,
        outputDir: tempRoot,
        files: [wavPath],
        locale: 'en',
        metadata: {
          title: 'Fixture',
          artist: 'Split Mono Tester',
          license: { id: 'CC-BY-4.0' }
        },
        splitStereoFiles: [wavPath]
      },
      onProgress: () => {}
    });

    expect(result.archives).toHaveLength(1);
    const archiveBuffer = await fs.promises.readFile(result.archives[0]);
    const entries = await extractZipEntries(archiveBuffer);
    expect(entries).toContain('fixture-L.wav');
    expect(entries).toContain('fixture-R.wav');
    expect(entries).not.toContain('fixture.wav');
    const originalExists = await fs.promises.stat(wavPath);
    expect(originalExists.isFile()).toBe(true);
  });
});
