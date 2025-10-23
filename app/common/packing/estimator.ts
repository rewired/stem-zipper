import {
  EST_LICENSE_BYTES,
  EST_SPLIT_RATIO,
  EST_STAMP_BYTES,
  EST_ZIP_OVERHEAD_BYTES
} from './constants';

export type EstimateFileKind = 'wav' | 'flac' | 'mp3' | 'aiff' | 'ogg' | 'aac' | 'wma';

export interface EstimateFileInput {
  path: string;
  sizeBytes: number;
  kind: EstimateFileKind;
  stereo?: boolean;
}

export interface EstimateRequest {
  files: EstimateFileInput[];
  targetMB: number;
}

export interface EstimateResponse {
  zips: number;
  bytesLogical: number;
  bytesCapacity: number;
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

  return {
    zips,
    bytesLogical: logicalBytes,
    bytesCapacity
  };
}
