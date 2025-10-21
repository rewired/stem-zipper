import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STAMP_FILENAME,
  STEM_ZIPPER_STAMP,
  bestFitPack,
  createBrandedZip,
  type SizedFile
} from '../packaging';

const MB = 1024 * 1024;

function makeSizedFile(name: string, sizeMb: number, extension: SizedFile['extension']): SizedFile {
  const size = Math.round(sizeMb * MB);
  return {
    path: path.join('/virtual', `${name}${extension}`),
    size,
    extension
  };
}

describe('bestFitPack', () => {
  it('packs files using the best-fit decreasing strategy', () => {
    const files: SizedFile[] = [
      makeSizedFile('alpha', 10, '.wav'),
      makeSizedFile('bravo', 8, '.wav'),
      makeSizedFile('charlie', 7, '.wav'),
      makeSizedFile('delta', 6, '.wav'),
      makeSizedFile('echo', 5, '.wav')
    ];

    const bins = bestFitPack(files, 15 * MB);

    expect(bins).toHaveLength(3);
    expect(bins[0].map((file) => path.basename(file.path))).toEqual(['alpha.wav', 'echo.wav']);
    expect(bins[1].map((file) => path.basename(file.path))).toEqual(['bravo.wav', 'charlie.wav']);
    expect(bins[2].map((file) => path.basename(file.path))).toEqual(['delta.wav']);
  });
});

describe('createBrandedZip', () => {
  it('creates a zip archive that contains the payload and branding stamp', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-test-'));

    try {
      const sourceA = path.join(tempRoot, 'alpha.wav');
      const sourceB = path.join(tempRoot, 'bravo.mp3');
      await fs.promises.writeFile(sourceA, Buffer.from('file-a'));
      await fs.promises.writeFile(sourceB, Buffer.from('file-b'));

      const sizedFiles: SizedFile[] = [
        await statAsSizedFile(sourceA, '.wav'),
        await statAsSizedFile(sourceB, '.mp3')
      ];

      const zipPath = await createBrandedZip('test-pack', sizedFiles, tempRoot);
      const buffer = await fs.promises.readFile(zipPath);
      const entries = extractZipEntries(buffer);

      expect(entries).toContain('alpha.wav');
      expect(entries).toContain('bravo.mp3');
      expect(entries).toContain(STAMP_FILENAME);
      expect(buffer.includes(Buffer.from(STEM_ZIPPER_STAMP, 'utf-8'))).toBe(true);
    } finally {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
  });
});

async function statAsSizedFile(filePath: string, extension: SizedFile['extension']): Promise<SizedFile> {
  const stats = await fs.promises.stat(filePath);
  return {
    path: filePath,
    size: stats.size,
    extension
  };
}

function extractZipEntries(buffer: Buffer): string[] {
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
