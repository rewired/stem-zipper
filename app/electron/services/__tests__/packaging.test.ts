import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STAMP_FILENAME,
  STEM_ZIPPER_STAMP,
  analyzeFolder,
  bestFitPack,
  createBrandedZip,
  packFolder,
  type SizedFile
} from '../packaging';
import { normalizePackMetadata, createLicenseText } from '../packMetadata';
import type { NormalizedPackMetadata } from '../packMetadata';

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

describe('analyzeFolder', () => {
  it('sniffs lossy headers even when the extension suggests WAV', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-analyze-'));

    try {
      const disguisedPath = path.join(tempRoot, 'disguised.wav');
      const id3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21]);
      const payload = Buffer.concat([id3Header, Buffer.alloc(2048, 0)]);
      await fs.promises.writeFile(disguisedPath, payload);

      const entries = analyzeFolder(tempRoot, 50);
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe('mp3');
    } finally {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
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

describe('packFolder metadata integration', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.useRealTimers();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('throws when required metadata fields are missing', () => {
    expect(() =>
      normalizePackMetadata({
        title: '',
        artist: '',
        license: { id: 'CC-BY-4.0' }
      })
    ).toThrowError();
  });

  it('writes metadata files and augments the stamp when packing', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-pack-'));
    tempDirs.push(tempRoot);
    const source = path.join(tempRoot, 'alpha.wav');
    await fs.promises.writeFile(source, Buffer.from('test-audio'));

    const metadata = normalizePackMetadata({
      title: 'Test Track',
      artist: 'Unit Tester',
      license: { id: 'CC-BY-4.0' },
      album: 'Spec Suite',
      bpm: '128',
      key: 'F# minor',
      attribution: 'Unit Tester — Test Track',
      links: { artist_url: 'https://example.com', contact_email: 'test@example.com' }
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    const fixedDate = new Date('2025-05-23T10:15:30Z');
    vi.setSystemTime(fixedDate);

    const total = await packFolder(tempRoot, 128, 'en', metadata, () => {});
    expect(total).toBe(1);

    const zipPath = path.join(tempRoot, 'stems-01.zip');
    const buffer = await fs.promises.readFile(zipPath);
    const entries = extractZipEntries(buffer);
    expect(entries).toContain('PACK-METADATA.json');
    expect(entries).toContain('LICENSE.txt');
    expect(entries).toContain('ATTRIBUTION.txt');
    expect(entries).toContain(STAMP_FILENAME);

    const contents = extractZipContents(buffer);
    const metadataJson = contents['PACK-METADATA.json'].toString('utf-8');
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      title: 'Test Track',
      artist: 'Unit Tester',
      license: { id: 'CC-BY-4.0' },
      album: 'Spec Suite',
      bpm: '128',
      key: 'F# minor',
      attribution: 'Unit Tester — Test Track',
      links: {
        artist_url: 'https://example.com',
        contact_email: 'test@example.com'
      }
    });

    const licenseText = contents['LICENSE.txt'].toString('utf-8');
    expect(licenseText).toContain('https://creativecommons.org/licenses/by/4.0/');

    const attributionText = contents['ATTRIBUTION.txt'].toString('utf-8');
    expect(attributionText.trim()).toBe('Unit Tester — Test Track');

    const stampText = contents[STAMP_FILENAME].toString('utf-8');
    expect(stampText).toContain('[Metadata]');
    expect(stampText).toContain('Title: Test Track');
    expect(stampText).toContain('Artist: Unit Tester');
    expect(stampText).toContain('Album: Spec Suite');
    expect(stampText).toContain('BPM: 128');
    expect(stampText).toContain('Key: F# minor');
    expect(stampText).toContain('License: CC-BY-4.0');
    expect(stampText).toContain('Locale: en');
    expect(stampText).toContain('2025-05-23T10:15:30.000Z');
  });

  it('maps each license id to the expected Creative Commons URL', () => {
    const metadataBase: NormalizedPackMetadata = {
      title: 'Fixture',
      artist: 'Mapper',
      license: { id: 'CC-BY-4.0' }
    };

    const expectedUrls: Record<NormalizedPackMetadata['license']['id'], string> = {
      'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
      'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
      'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
      'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/'
    } as const;

    for (const [id, url] of Object.entries(expectedUrls) as [NormalizedPackMetadata['license']['id'], string][]) {
      const licenseText = createLicenseText({ ...metadataBase, license: { id } });
      expect(licenseText).toContain(url);
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

function extractZipContents(buffer: Buffer): Record<string, Buffer> {
  const signature = Buffer.from('504b0102', 'hex');
  const entries: Array<{
    name: string;
    localHeaderOffset: number;
    compressedSize: number;
    compression: number;
  }> = [];
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
    const localHeaderOffset = buffer.readUInt32LE(index + 42);
    const compressedSize = buffer.readUInt32LE(index + 20);
    const compression = buffer.readUInt16LE(index + 10);
    entries.push({ name, localHeaderOffset, compressedSize, compression });
    offset = nameEnd + extraLength + commentLength;
  }

  const contents: Record<string, Buffer> = {};
  for (const entry of entries) {
    const headerSignature = buffer.readUInt32LE(entry.localHeaderOffset);
    if (headerSignature !== 0x04034b50) {
      continue;
    }
    const nameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const extraLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    const data = buffer.slice(dataStart, dataEnd);
    if (entry.compression === 0) {
      contents[entry.name] = Buffer.from(data);
    } else if (entry.compression === 8) {
      contents[entry.name] = Buffer.from(zlib.inflateRawSync(data));
    }
  }

  return contents;
}
