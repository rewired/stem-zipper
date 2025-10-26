import { describe, expect, it } from 'vitest';
import { estimatePackingPlan } from '../packEstimator';
import type { PackingPlanRequest } from '../../../common/ipc/contracts';

const MB = 1024 * 1024;

describe('estimatePackingPlan', () => {
  it('flags files larger than the ZIP capacity', () => {
    const request: PackingPlanRequest = {
      method: 'zip',
      maxArchiveSizeMb: 50,
      files: [
        { path: '/huge.wav', sizeBytes: 60 * MB },
        { path: '/small.wav', sizeBytes: 10 * MB }
      ],
      splitStereo: false
    };

    const result = estimatePackingPlan(request);
    expect(result.plan).toHaveLength(2);
    expect(result.plan[0]).toMatchObject({ path: '/huge.wav', allowed: false, reason: 'zip_too_large' });
    expect(result.plan[1]).toMatchObject({ path: '/small.wav', allowed: true, archiveIndex: 1 });
  });

  it('allocates additional ZIP archives when capacity is exceeded', () => {
    const request: PackingPlanRequest = {
      method: 'zip',
      maxArchiveSizeMb: 20,
      files: [
        { path: '/kick.wav', sizeBytes: 9 * MB },
        { path: '/snare.wav', sizeBytes: 9 * MB },
        { path: '/hihat.wav', sizeBytes: 9 * MB }
      ],
      splitStereo: false
    };

    const result = estimatePackingPlan(request);
    expect(result.plan.map((entry) => entry.archiveIndex)).toEqual([1, 1, 2]);
    expect(result.plan.every((entry) => entry.allowed)).toBe(true);
  });

  it('keeps every file selectable for 7z plans', () => {
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
