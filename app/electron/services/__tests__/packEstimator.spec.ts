import { describe, expect, it } from 'vitest';
import { estimatePackingPlan } from '../packEstimator';
import type { PackingPlanFileInput, PackingPlanRequest } from '../../../common/ipc/contracts';

const MB = 1024 * 1024;

function createRequest(partial: Partial<PackingPlanRequest>): PackingPlanRequest {
  return {
    method: 'zip',
    maxArchiveSizeMb: 48,
    files: [],
    splitStereo: false,
    ...partial
  };
}

describe('estimatePackingPlan', () => {
  it('suggests split-mono for stereo WAV that exceeds the archive limit', () => {
    const stereoSize = Math.floor(94.51 * MB);
    const stereoProbe: PackingPlanFileInput = {
      path: '/stereo.wav',
      sizeBytes: stereoSize,
      codec: 'wav_pcm',
      num_channels: 2,
      header_bytes: 44
    };
    const request = createRequest({
      files: [stereoProbe]
    });

    const result = estimatePackingPlan(request);
    expect(result.plan).toHaveLength(1);
    const [entry] = result.plan;
    expect(entry.allowed).toBe(true);
    expect(entry.suggestSplitMono).toBe(true);
    expect(entry.splitTargets).toHaveLength(2);
    const archiveIndices = entry.splitTargets?.map((target) => target.archiveIndex) ?? [];
    expect(archiveIndices.every((index) => typeof index === 'number' && index >= 1)).toBe(true);
  });

  it('marks split mono infeasible when per-channel size still exceeds capacity', () => {
    const hugeStereo = Math.floor(160 * MB);
    const probe: PackingPlanFileInput = {
      path: '/oversized.wav',
      sizeBytes: hugeStereo,
      codec: 'wav_pcm',
      num_channels: 2,
      header_bytes: 44
    };
    const request = createRequest({
      files: [probe]
    });

    const result = estimatePackingPlan(request);
    expect(result.plan).toHaveLength(1);
    const [entry] = result.plan;
    expect(entry.allowed).toBe(false);
    expect(entry.suggestSplitMono).toBeUndefined();
  });

  it('keeps output deterministic across calls', () => {
    const files: PackingPlanFileInput[] = [
      {
        path: '/alpha.wav',
        sizeBytes: Math.floor(32 * MB),
        codec: 'wav_pcm',
        num_channels: 2,
        header_bytes: 44
      },
      {
        path: '/bravo.wav',
        sizeBytes: Math.floor(28 * MB),
        codec: 'wav_pcm',
        num_channels: 2,
        header_bytes: 44
      }
    ];
    const request = createRequest({ files });

    const first = estimatePackingPlan(request);
    const second = estimatePackingPlan(request);

    expect(first.plan).toEqual(second.plan);
  });

  it('leaves seven-zip plans untouched', () => {
    const request: PackingPlanRequest = {
      method: '7z',
      maxArchiveSizeMb: 5,
      files: [
        { path: '/intro.wav', sizeBytes: 4 * MB },
        { path: '/chorus.wav', sizeBytes: 6 * MB }
      ],
      splitStereo: false
    };

    const result = estimatePackingPlan(request);
    expect(result.plan.every((entry) => entry.allowed)).toBe(true);
    expect(result.plan.map((entry) => entry.archiveIndex)).toEqual([1, 2]);
  });
});
