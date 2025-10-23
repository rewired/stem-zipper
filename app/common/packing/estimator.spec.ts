import { describe, expect, it } from 'vitest';
import {
  EST_LICENSE_BYTES,
  EST_SPLIT_RATIO,
  EST_STAMP_BYTES,
  EST_ZIP_OVERHEAD_BYTES
} from './constants';
import { estimateZipCount } from './estimator';

describe('estimateZipCount', () => {
  it('splits oversized stereo WAVs', () => {
    const targetMB = 10;
    const wavSize = 15 * 1024 * 1024;
    const result = estimateZipCount({
      files: [
        {
          path: '/track.wav',
          sizeBytes: wavSize,
          kind: 'wav',
          stereo: true
        }
      ],
      targetMB
    });
    const targetBytes = Math.max(1, Math.floor(targetMB * 1024 * 1024));
    const expectedLogical = Math.ceil(wavSize * EST_SPLIT_RATIO);
    const expectedCapacity = Math.max(
      1,
      targetBytes - (EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES)
    );
    expect(result.bytesLogical).toBe(expectedLogical);
    expect(result.bytesCapacity).toBe(expectedCapacity);
    expect(result.zips).toBe(Math.max(1, Math.ceil(expectedLogical / expectedCapacity)));
  });

  it('does not split mono WAVs or non-WAV files', () => {
    const targetMB = 8;
    const wavSize = 12 * 1024 * 1024;
    const flacSize = 9 * 1024 * 1024;
    const result = estimateZipCount({
      files: [
        {
          path: '/mono.wav',
          sizeBytes: wavSize,
          kind: 'wav',
          stereo: false
        },
        {
          path: '/track.flac',
          sizeBytes: flacSize,
          kind: 'flac'
        }
      ],
      targetMB
    });
    expect(result.bytesLogical).toBe(wavSize + flacSize);
  });

  it('reduces capacity by ZIP overhead', () => {
    const targetMB = 5;
    const result = estimateZipCount({
      files: [],
      targetMB
    });
    const targetBytes = Math.max(1, Math.floor(targetMB * 1024 * 1024));
    const overhead = EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;
    expect(result.bytesCapacity).toBe(Math.max(1, targetBytes - overhead));
    expect(result.bytesCapacity).toBeLessThan(targetBytes);
  });

  it('clamps minimal capacity and zip count to at least one', () => {
    const result = estimateZipCount({
      files: [
        {
          path: '/silence.wav',
          sizeBytes: 0,
          kind: 'wav',
          stereo: true
        }
      ],
      targetMB: 0
    });
    expect(result.bytesCapacity).toBeGreaterThanOrEqual(1);
    expect(result.zips).toBe(1);
  });

  it('aggregates mixed sets with ceiling division', () => {
    const targetMB = 20;
    const files = [
      { path: '/a.wav', sizeBytes: 22 * 1024 * 1024, kind: 'wav', stereo: true },
      { path: '/b.mp3', sizeBytes: 6 * 1024 * 1024, kind: 'mp3' }
    ];
    const result = estimateZipCount({ files, targetMB });
    const targetBytes = Math.max(1, Math.floor(targetMB * 1024 * 1024));
    const expectedCapacity = Math.max(
      1,
      targetBytes - (EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES)
    );
    const logical = Math.ceil(files[0].sizeBytes * EST_SPLIT_RATIO) + files[1].sizeBytes;
    expect(result.bytesLogical).toBe(logical);
    expect(result.zips).toBe(Math.max(1, Math.ceil(logical / expectedCapacity)));
  });
});
