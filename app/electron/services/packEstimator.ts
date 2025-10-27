import { EST_LICENSE_BYTES, EST_STAMP_BYTES, EST_ZIP_OVERHEAD_BYTES } from '../../common/packing/constants';
import type {
  PackingEstimatorMethod,
  PackingPlanEntry,
  PackingPlanRequest,
  PackingPlanResponse,
  PackingPlanSplitTarget
} from '../../common/ipc/contracts';

const ZIP_OVERHEAD_BYTES = EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;
const WAV_HEADROOM = 0.98;
const DEFAULT_WAV_HEADER_BYTES = 44;

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

interface SplitCandidate {
  estimatedSize: number;
  rawSize: number;
}

interface PlanMetrics {
  entries: PackingPlanEntry[];
  disallowed: number;
  archiveCount: number;
  slackTotal: number;
}

function computeSevenZPlan(request: PackingPlanRequest, capacityBytes: number): PackingPlanResponse {
  const plan: PackingPlanEntry[] = [];
  let archiveIndex = 1;
  let usedBytes = 0;

  for (const file of request.files) {
    const sizeBytes = normalizeFileSize(file.sizeBytes);
    let assignedIndex = archiveIndex;
    if (Number.isFinite(capacityBytes) && usedBytes > 0 && usedBytes + sizeBytes > capacityBytes) {
      archiveIndex += 1;
      assignedIndex = archiveIndex;
      usedBytes = 0;
    }
    if (Number.isFinite(capacityBytes)) {
      usedBytes = Math.min(capacityBytes, usedBytes + sizeBytes);
      if (usedBytes >= capacityBytes) {
        archiveIndex += 1;
        usedBytes = 0;
      }
    }

    plan.push({
      path: file.path,
      archiveIndex: assignedIndex,
      archiveLabel: computeArchiveLabel('7z', assignedIndex),
      allowed: true
    });
  }

  return { plan };
}

function resolveSplitCandidate(file: PackingPlanRequest['files'][number], capacity: number): SplitCandidate | null {
  if (file.codec !== 'wav_pcm' && file.codec !== 'wav_float') {
    return null;
  }
  const channels = typeof file.num_channels === 'number' ? file.num_channels : file.stereo ? 2 : undefined;
  if (!channels || channels < 2) {
    return null;
  }
  if (channels !== 2) {
    return null;
  }
  const headerBytes = Math.max(
    DEFAULT_WAV_HEADER_BYTES,
    typeof file.header_bytes === 'number' && Number.isFinite(file.header_bytes) ? Math.floor(file.header_bytes) : DEFAULT_WAV_HEADER_BYTES
  );
  const sizeBytes = normalizeFileSize(file.sizeBytes);
  const payload = Math.max(0, sizeBytes - headerBytes);
  const perChannelPayload = payload / channels;
  const perChannelTotal = perChannelPayload + headerBytes;
  if (perChannelTotal <= 0 || !Number.isFinite(perChannelTotal)) {
    return null;
  }
  if (capacity > 0 && perChannelTotal > capacity) {
    return null;
  }
  const estimatedSize = Math.ceil(perChannelTotal * WAV_HEADROOM);
  const rawSize = Math.ceil(perChannelTotal);
  return { estimatedSize, rawSize };
}

function buildZipPlan(
  request: PackingPlanRequest,
  capacity: number,
  splitCandidates: Map<string, SplitCandidate>,
  splitSet: Set<string>
): PlanMetrics {
  const entries: PackingPlanEntry[] = [];
  const usage = new Map<number, number>();
  let archiveIndex = 1;
  let usedBytes = 0;
  let disallowed = 0;

  const assign = (
    size: number,
    rawSize?: number
  ): { allowed: boolean; index: number; reason?: string } => {
    if (capacity <= 0) {
      const index = archiveIndex;
      archiveIndex += 1;
      usedBytes = 0;
      return { allowed: false, index, reason: 'zip_too_large' };
    }
    const effectiveRaw = typeof rawSize === 'number' && Number.isFinite(rawSize) ? rawSize : size;
    if (effectiveRaw > capacity) {
      const index = archiveIndex;
      archiveIndex += 1;
      usedBytes = 0;
      return { allowed: false, index, reason: 'zip_too_large' };
    }
    if (size > capacity) {
      const index = archiveIndex;
      archiveIndex += 1;
      usedBytes = 0;
      return { allowed: false, index, reason: 'zip_too_large' };
    }
    if (usedBytes > 0 && usedBytes + size > capacity) {
      archiveIndex += 1;
      usedBytes = 0;
    }
    const index = archiveIndex;
    usedBytes = Math.min(capacity, usedBytes + size);
    const currentUsage = usage.get(index) ?? 0;
    usage.set(index, Math.min(capacity, currentUsage + size));
    if (usedBytes >= capacity) {
      archiveIndex += 1;
      usedBytes = 0;
    }
    return { allowed: true, index };
  };

  for (const file of request.files) {
    const sizeBytes = normalizeFileSize(file.sizeBytes);
    const candidate = splitSet.has(file.path) ? splitCandidates.get(file.path) : undefined;

    if (candidate) {
      const targets: PackingPlanSplitTarget[] = [];
      let allowed = true;
      let reason: string | undefined;
      for (const channel of ['L', 'R'] as const) {
        const placement = assign(candidate.estimatedSize, candidate.rawSize);
        if (!placement.allowed) {
          allowed = false;
          reason = placement.reason;
          break;
        }
        targets.push({
          channel,
          archiveIndex: placement.index,
          archiveLabel: computeArchiveLabel('zip', placement.index)
        });
      }
      if (!allowed) {
        disallowed += 1;
      }
      const fallbackIndex = computeArchiveIndexFallback(entries);
      const firstTarget = targets[0];
      entries.push({
        path: file.path,
        archiveIndex: firstTarget ? firstTarget.archiveIndex : fallbackIndex,
        archiveLabel: firstTarget ? firstTarget.archiveLabel : computeArchiveLabel('zip', fallbackIndex),
        allowed,
        reason,
        suggestSplitMono: true,
        splitTargets: targets.length > 0 ? targets : undefined
      });
      continue;
    }

    const placement = assign(sizeBytes);
    if (!placement.allowed) {
      disallowed += 1;
    }
    entries.push({
      path: file.path,
      archiveIndex: placement.index,
      archiveLabel: computeArchiveLabel('zip', placement.index),
      allowed: placement.allowed,
      reason: placement.reason
    });
  }

  const archiveCount = entries.reduce((max, entry) => Math.max(max, entry.archiveIndex), 0);
  const slackTotal = Array.from(usage.values()).reduce((total, used) => total + Math.max(0, capacity - used), 0);

  return { entries, disallowed, archiveCount, slackTotal };
}

function computeArchiveIndexFallback(entries: PackingPlanEntry[]): number {
  if (entries.length === 0) {
    return 1;
  }
  return entries[entries.length - 1].archiveIndex;
}

function chooseBetterPlan(current: PlanMetrics, next: PlanMetrics, targetPath: string): boolean {
  const currentEntry = current.entries.find((entry) => entry.path === targetPath);
  const nextEntry = next.entries.find((entry) => entry.path === targetPath);
  const currentAllowed = currentEntry?.allowed ?? false;
  const nextAllowed = nextEntry?.allowed ?? false;

  if (!currentAllowed && nextAllowed) {
    return true;
  }
  if (next.disallowed < current.disallowed) {
    return true;
  }
  if (next.disallowed > current.disallowed) {
    return false;
  }
  if (next.archiveCount < current.archiveCount) {
    return true;
  }
  if (next.archiveCount > current.archiveCount) {
    return false;
  }
  if (next.slackTotal < current.slackTotal) {
    return true;
  }
  if (next.slackTotal > current.slackTotal) {
    return false;
  }
  return false;
}

function computeZipPlan(request: PackingPlanRequest, capacity: number): PackingPlanResponse {
  const splitCandidates = new Map<string, SplitCandidate>();
  for (const file of request.files) {
    const candidate = resolveSplitCandidate(file, capacity);
    if (candidate) {
      splitCandidates.set(file.path, candidate);
    }
  }

  const requiredSplit = new Set<string>();
  for (const file of request.files) {
    if (!splitCandidates.has(file.path)) {
      continue;
    }
    if (capacity > 0 && normalizeFileSize(file.sizeBytes) > capacity) {
      requiredSplit.add(file.path);
    }
  }

  let bestSplit = new Set(requiredSplit);
  let bestPlan = buildZipPlan(request, capacity, splitCandidates, bestSplit);

  const optional = request.files
    .filter((file) => splitCandidates.has(file.path) && !requiredSplit.has(file.path))
    .map((file) => ({ path: file.path, size: normalizeFileSize(file.sizeBytes) }))
    .sort((a, b) => {
      if (b.size !== a.size) {
        return b.size - a.size;
      }
      return a.path.localeCompare(b.path);
    });

  for (const candidate of optional) {
    const trialSplit = new Set(bestSplit);
    trialSplit.add(candidate.path);
    const trialPlan = buildZipPlan(request, capacity, splitCandidates, trialSplit);
    if (chooseBetterPlan(bestPlan, trialPlan, candidate.path)) {
      bestSplit = trialSplit;
      bestPlan = trialPlan;
    }
  }

  return { plan: bestPlan.entries };
}

export function estimatePackingPlan(request: PackingPlanRequest): PackingPlanResponse {
  const method = request.method;
  const normalizedMax = normalizeMaxSizeMb(request.maxArchiveSizeMb);
  const maxBytes = normalizedMax > 0 ? normalizedMax * 1024 * 1024 : 0;
  if (method !== 'zip') {
    const sevenZCapacityBytes = maxBytes > 0 ? maxBytes : Number.POSITIVE_INFINITY;
    return computeSevenZPlan(request, sevenZCapacityBytes);
  }
  const zipCapacityBytes = Math.max(0, maxBytes - ZIP_OVERHEAD_BYTES);
  return computeZipPlan(request, zipCapacityBytes);
}
