import type { EstimateFileKind } from '../packing/estimator';
import type { AudioCodec } from '../types';

export type PackingEstimatorMethod = 'zip' | '7z';

export interface PackingPlanFileInput {
  path: string;
  sizeBytes: number;
  kind?: EstimateFileKind;
  stereo?: boolean;
  codec?: AudioCodec;
  num_channels?: number;
  header_bytes?: number;
}

export interface PackingPlanEntry {
  path: string;
  archiveIndex: number;
  archiveLabel: string;
  allowed: boolean;
  reason?: string;
  suggestSplitMono?: boolean;
  splitTargets?: PackingPlanSplitTarget[];
}

export interface PackingPlanSplitTarget {
  channel: 'L' | 'R';
  archiveIndex: number;
  archiveLabel: string;
}

export interface PackingPlanRequest {
  method: PackingEstimatorMethod;
  maxArchiveSizeMb: number;
  files: PackingPlanFileInput[];
  splitStereo: boolean;
}

export interface PackingPlanResponse {
  plan: PackingPlanEntry[];
}
