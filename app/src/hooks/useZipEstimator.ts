import { useMemo } from 'react';
import type { FileEntry } from '@common/ipc';
import {
  estimatePacking,
  isCompressedExt,
  isLossyKind,
  type PackingOverflowReason
} from '@common/packing/estimator';
import { getFileExtension } from '../utils/path';

interface ZipEstimatorWarning {
  reason: PackingOverflowReason;
  targetVolume: number;
}

interface UseZipEstimatorOptions {
  maxSizeMb: number | '';
  allowMultiVolume?: boolean;
}

export interface FileBadgeFlags {
  noZipGain?: boolean;
  consider7zVolumes?: boolean;
}

interface UseZipEstimatorResult {
  warnings: Map<string, ZipEstimatorWarning>;
  badges: Map<string, FileBadgeFlags>;
  maxZipSizeBytes?: number;
}

export function useZipEstimator(
  files: readonly FileEntry[],
  options: UseZipEstimatorOptions
): UseZipEstimatorResult {
  const { maxSizeMb, allowMultiVolume } = options;
  return useMemo(() => {
    const normalizedMaxSize =
      typeof maxSizeMb === 'number' && Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : undefined;
    const badges = new Map<string, FileBadgeFlags>();

    for (const file of files) {
      const extension = getFileExtension(file.path ?? '');
      if (!isCompressedExt(extension)) {
        continue;
      }
      const flags: FileBadgeFlags = { noZipGain: true };
      if (typeof normalizedMaxSize === 'number' && file.sizeMb > normalizedMaxSize) {
        flags.consider7zVolumes = true;
      }
      badges.set(file.path, flags);
    }

    if (typeof normalizedMaxSize !== 'number') {
      return { warnings: new Map<string, ZipEstimatorWarning>(), badges };
    }

    const maxZipSizeBytes = Math.floor(normalizedMaxSize * 1024 * 1024);
    if (maxZipSizeBytes <= 0) {
      return { warnings: new Map<string, ZipEstimatorWarning>(), badges };
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

    return { warnings, maxZipSizeBytes, badges };
  }, [allowMultiVolume, files, maxSizeMb]);
}
