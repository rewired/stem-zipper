import type { EstimateFileKind } from '../packing/estimator';

export type PackingEstimatorMethod = 'zip' | '7z';

export interface PackingPlanFileInput {
  path: string;
  sizeBytes: number;
  kind?: EstimateFileKind;
  stereo?: boolean;
}

export interface PackingPlanEntry {
  path: string;
  archiveIndex: number;
  archiveLabel: string;
  allowed: boolean;
  reason?: string;
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
