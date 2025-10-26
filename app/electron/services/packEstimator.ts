import { EST_LICENSE_BYTES, EST_STAMP_BYTES, EST_ZIP_OVERHEAD_BYTES } from '../../common/packing/constants';
import type {
  PackingEstimatorMethod,
  PackingPlanEntry,
  PackingPlanRequest,
  PackingPlanResponse
} from '../../common/ipc/contracts';

const ZIP_OVERHEAD_BYTES = EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;

function normalizeMaxSizeMb(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeFileSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    return 0;
  }
  return Math.floor(size);
}

function computeArchiveLabel(method: PackingEstimatorMethod, index: number): string {
  const padded = String(Math.max(1, index)).padStart(2, '0');
  return method === 'zip' ? `stems-${padded}.zip` : `vol-${padded}.7z`;
}

export function estimatePackingPlan(request: PackingPlanRequest): PackingPlanResponse {
  const method = request.method;
  const normalizedMax = normalizeMaxSizeMb(request.maxArchiveSizeMb);
  const maxBytes = normalizedMax > 0 ? normalizedMax * 1024 * 1024 : 0;
  const plan: PackingPlanEntry[] = [];
  const isZip = method === 'zip';
  const zipCapacityBytes = isZip ? Math.max(0, maxBytes - ZIP_OVERHEAD_BYTES) : 0;
  const sevenZCapacityBytes = !isZip && maxBytes > 0 ? maxBytes : Number.POSITIVE_INFINITY;

  let archiveIndex = 1;
  let usedBytes = 0;

  for (const file of request.files) {
    const sizeBytes = normalizeFileSize(file.sizeBytes);
    let allowed = true;
    let reason: string | undefined;
    let assignedIndex = archiveIndex;

    if (isZip) {
      if (zipCapacityBytes <= 0) {
        allowed = false;
        reason = 'zip_too_large';
      } else if (sizeBytes > zipCapacityBytes) {
        allowed = false;
        reason = 'zip_too_large';
      } else {
        if (usedBytes > 0 && usedBytes + sizeBytes > zipCapacityBytes) {
          archiveIndex += 1;
          assignedIndex = archiveIndex;
          usedBytes = 0;
        }
        usedBytes = Math.min(zipCapacityBytes, usedBytes + sizeBytes);
        if (usedBytes >= zipCapacityBytes) {
          archiveIndex += 1;
          usedBytes = 0;
        }
      }
    } else {
      if (Number.isFinite(sevenZCapacityBytes) && usedBytes > 0 && usedBytes + sizeBytes > sevenZCapacityBytes) {
        archiveIndex += 1;
        assignedIndex = archiveIndex;
        usedBytes = 0;
      }
      if (Number.isFinite(sevenZCapacityBytes)) {
        usedBytes = Math.min(sevenZCapacityBytes, usedBytes + sizeBytes);
        if (usedBytes >= sevenZCapacityBytes) {
          archiveIndex += 1;
          usedBytes = 0;
        }
      }
    }

    const archiveLabel = computeArchiveLabel(method, assignedIndex);

    plan.push({
      path: file.path,
      archiveIndex: assignedIndex,
      archiveLabel,
      allowed: isZip ? allowed : true,
      reason: isZip ? reason : undefined
    });
  }

  return { plan };
}
