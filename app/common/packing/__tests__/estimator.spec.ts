import { describe, expect, it } from 'vitest';
import {
  EST_LICENSE_BYTES,
  EST_SPLIT_RATIO,
  EST_STAMP_BYTES,
  EST_ZIP_OVERHEAD_BYTES
} from '../constants';
import {
  estimateZipCount,
  type EstimateFileInput,
  type EstimateRequest
} from '../estimator';

const MB = 1024 * 1024;

function makeRequest(partial: Partial<EstimateRequest>): EstimateRequest {
  return {
    targetMB: 48,
    files: [],
    ...partial
  };
}

describe('estimateZipCount', () => {
  it('applies the split ratio only to oversized stereo WAV files', () => {
    const targetMB = 40;
    const request = makeRequest({
      targetMB,
      files: [
        { path: 'a.wav', sizeBytes: 80 * MB, kind: 'wav', stereo: true },
        { path: 'b.wav', sizeBytes: 20 * MB, kind: 'wav', stereo: true },
        { path: 'c.wav', sizeBytes: 90 * MB, kind: 'wav' },
        { path: 'd.mp3', sizeBytes: 5 * MB, kind: 'mp3', stereo: true }
      ] satisfies EstimateFileInput[]
    });

    const result = estimateZipCount(request);
    const targetBytes = Math.floor(targetMB * MB);
    const expectedFirst = Math.ceil(80 * MB * EST_SPLIT_RATIO);
    const expectedSecond = Math.ceil(20 * MB);
    const expectedThird = Math.ceil(90 * MB);
    const expectedFourth = Math.ceil(5 * MB);

    expect(result.bytesLogical).toBe(expectedFirst + expectedSecond + expectedThird + expectedFourth);
  });

  it('reduces available capacity by the configured overheads', () => {
    const request = makeRequest({ targetMB: 64 });
    const result = estimateZipCount(request);
    const targetBytes = Math.floor(64 * MB);
    const expectedCapacity = targetBytes - (EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES);

    expect(result.bytesCapacity).toBe(expectedCapacity);
  });

  it('clamps capacity and zip count to a minimum of one', () => {
    const result = estimateZipCount(
      makeRequest({
        targetMB: 0,
        files: [
          { path: 'tiny.wav', sizeBytes: 0, kind: 'wav' }
        ] satisfies EstimateFileInput[]
      })
    );

    expect(result.bytesCapacity).toBe(1);
    expect(result.zips).toBe(1);
  });

  it('ceil-divides logical bytes by capacity for mixed inputs', () => {
    const targetMB = 32;
    const files = [
      { path: 'alpha.wav', sizeBytes: 50 * MB, kind: 'wav', stereo: true },
      { path: 'bravo.flac', sizeBytes: 10.5 * MB, kind: 'flac' },
      { path: 'charlie.mp3', sizeBytes: 4.2 * MB, kind: 'mp3' }
    ] satisfies EstimateFileInput[];
    const request = makeRequest({ targetMB, files });

    const result = estimateZipCount(request);
    const targetBytes = Math.floor(targetMB * MB);
    const capacity = Math.max(
      1,
      targetBytes - (EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES)
    );
    const logical =
      Math.ceil(50 * MB * EST_SPLIT_RATIO) + Math.ceil(10.5 * MB) + Math.ceil(4.2 * MB);
    const expectedZips = Math.max(1, Math.ceil(logical / capacity));

    expect(result.bytesLogical).toBe(logical);
    expect(result.zips).toBe(expectedZips);
  });
});
