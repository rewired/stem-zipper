import { useMemo } from 'react';
import type { FileEntry } from '@common/ipc';
import {
  estimatePacking,
  isLossyKind,
  type PackingOverflowReason
} from '@common/packing/estimator';

interface ZipEstimatorWarning {
  reason: PackingOverflowReason;
  targetVolume: number;
}

interface UseZipEstimatorOptions {
  maxSizeMb: number | '';
  allowMultiVolume?: boolean;
}

interface UseZipEstimatorResult {
  warnings: Map<string, ZipEstimatorWarning>;
  maxZipSizeBytes?: number;
}

export function useZipEstimator(
  files: readonly FileEntry[],
  options: UseZipEstimatorOptions
): UseZipEstimatorResult {
  const { maxSizeMb, allowMultiVolume } = options;
  return useMemo(() => {
    if (typeof maxSizeMb !== 'number' || !Number.isFinite(maxSizeMb) || maxSizeMb <= 0) {
      return { warnings: new Map<string, ZipEstimatorWarning>() };
    }

    const maxZipSizeBytes = Math.floor(maxSizeMb * 1024 * 1024);
    if (maxZipSizeBytes <= 0) {
      return { warnings: new Map<string, ZipEstimatorWarning>() };
    }

    const packing = estimatePacking(
      files.map((file) => ({
        path: file.path,
        sizeBytes: file.sizeBytes,
        kind: file.kind,
        stereo: file.stereo
      })),
      { maxZipSize: maxZipSizeBytes }
    );

    const warnings = new Map<string, ZipEstimatorWarning>();
    const allowVolumeOverflow = allowMultiVolume === true;
    const fileByPath = new Map(files.map((file) => [file.path, file] as const));

    for (const entry of packing.files) {
      if (!entry.overflowReason) {
        continue;
      }
      const file = fileByPath.get(entry.path);
      if (!file) {
        continue;
      }
      if (!isLossyKind(file.kind)) {
        continue;
      }
      if (entry.overflowReason === 'needs_new_volume' && allowVolumeOverflow) {
        continue;
      }
      warnings.set(entry.path, {
        reason: entry.overflowReason,
        targetVolume: entry.targetVolume
      });
    }

    return { warnings, maxZipSizeBytes };
  }, [allowMultiVolume, files, maxSizeMb]);
}
