import {
  EST_LICENSE_BYTES,
  EST_SPLIT_RATIO,
  EST_STAMP_BYTES,
  EST_ZIP_OVERHEAD_BYTES,
  LOSSY_ZIP_RATIO
} from './constants';

export type EstimateFileKind = 'wav' | 'flac' | 'mp3' | 'aiff' | 'ogg' | 'aac' | 'm4a' | 'opus' | 'wma';

export interface EstimateFileInput {
  path: string;
  sizeBytes: number;
  kind: EstimateFileKind;
  stereo?: boolean;
}

export interface EstimateRequest {
  files: EstimateFileInput[];
  targetMB: number;
  token?: string;
}

export interface EstimateResponse {
  zips: number;
  bytesLogical: number;
  bytesCapacity: number;
  packing: PackingEstimate;
}

export type PackingOverflowReason =
  | 'file_exceeds_limit'
  | 'exceeds_capacity'
  | 'needs_new_volume';

export interface PackingEstimateFile {
  path: string;
  rawBytes: number;
  effectiveBytes: number;
  targetVolume: number;
  overflowReason: PackingOverflowReason | null;
}

export interface PackingEstimate {
  maxZipSize: number;
  capacityBytes: number;
  perZipOverheadBytes: number;
  files: PackingEstimateFile[];
}

interface EstimatePackingOptions {
  maxZipSize: number;
  perZipOverhead?: number;
  compressRatioByKind?: Partial<Record<EstimateFileKind, number>>;
}

const LOSSY_KIND_SET = new Set<EstimateFileKind>([
  'mp3',
  'aac',
  'm4a',
  'ogg',
  'opus',
  'wma'
]);

export function isLossyKind(kind: EstimateFileKind): boolean {
  return LOSSY_KIND_SET.has(kind);
}

function resolveKindCompressionRatio(
  kind: EstimateFileKind,
  compressRatioByKind: EstimatePackingOptions['compressRatioByKind']
): number {
  if (isLossyKind(kind)) {
    return LOSSY_ZIP_RATIO;
  }
  const ratio = compressRatioByKind?.[kind];
  if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) {
    return ratio;
  }
  return 1.0;
}

export function estimatePacking(
  files: EstimateFileInput[],
  options: EstimatePackingOptions
): PackingEstimate {
  const perZipOverhead = options.perZipOverhead ?? EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;
  const maxZipSize = Number.isFinite(options.maxZipSize) && options.maxZipSize > 0 ? options.maxZipSize : 0;
  const capacityBytes = Math.max(0, maxZipSize - perZipOverhead);
  const compressRatioByKind = options.compressRatioByKind;
  const estimateFiles: PackingEstimateFile[] = [];

  let currentVolume = 1;
  let usedBytes = 0;

  for (const file of files) {
    const ratio = resolveKindCompressionRatio(file.kind, compressRatioByKind);
    const effectiveBytes = Math.ceil(file.sizeBytes * ratio);
    const fileExceedsLimit = maxZipSize > 0 && file.sizeBytes >= maxZipSize;
    const capacityUnavailable = capacityBytes <= 0;
    const exceedsCapacity = !capacityUnavailable && effectiveBytes > capacityBytes;
    let overflowReason: PackingOverflowReason | null = null;
    let targetVolume = currentVolume;

    if (fileExceedsLimit) {
      overflowReason = 'file_exceeds_limit';
    } else if (capacityUnavailable || exceedsCapacity) {
      overflowReason = 'exceeds_capacity';
    } else if (usedBytes + effectiveBytes > capacityBytes) {
      currentVolume += 1;
      targetVolume = currentVolume;
      overflowReason = 'needs_new_volume';
      usedBytes = effectiveBytes;
    } else {
      usedBytes += effectiveBytes;
    }

    estimateFiles.push({
      path: file.path,
      rawBytes: file.sizeBytes,
      effectiveBytes,
      targetVolume,
      overflowReason
    });

    if (overflowReason && overflowReason !== 'needs_new_volume') {
      currentVolume += 1;
      usedBytes = 0;
    } else if (!overflowReason && capacityBytes > 0 && usedBytes >= capacityBytes) {
      currentVolume += 1;
      usedBytes = 0;
    }
  }

  return {
    maxZipSize,
    capacityBytes,
    perZipOverheadBytes: perZipOverhead,
    files: estimateFiles
  };
}

function normalizeTargetBytes(targetMB: number): number {
  if (!Number.isFinite(targetMB)) {
    return 0;
  }
  if (targetMB <= 0) {
    return 0;
  }
  return Math.floor(targetMB * 1024 * 1024);
}

function computeLogicalBytes(files: EstimateFileInput[], targetBytes: number): number {
  return files.reduce((total, file) => {
    if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
      return total;
    }
    if (file.kind === 'wav' && file.stereo === true && file.sizeBytes > targetBytes) {
      const splitSize = Math.ceil(file.sizeBytes * EST_SPLIT_RATIO);
      return total + splitSize;
    }
    return total + Math.ceil(file.sizeBytes);
  }, 0);
}

export function estimateZipCount(request: EstimateRequest): EstimateResponse {
  const targetBytes = normalizeTargetBytes(request.targetMB);
  const perZipOverhead = EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;
  const rawCapacity = targetBytes - perZipOverhead;
  const bytesCapacity = rawCapacity > 0 ? rawCapacity : 1;
  const logicalBytes = computeLogicalBytes(request.files, targetBytes);
  const quotient = bytesCapacity > 0 ? logicalBytes / bytesCapacity : logicalBytes;
  const zips = Math.max(1, Math.ceil(quotient));

  const packing = estimatePacking(request.files, {
    maxZipSize: targetBytes,
    perZipOverhead
  });

  return {
    zips,
    bytesLogical: logicalBytes,
    bytesCapacity,
    packing
  };
}
