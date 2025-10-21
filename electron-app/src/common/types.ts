export type StemAction = 'normal' | 'split_mono' | 'split_zip';

export interface StemAnalysisEntry {
  fileName: string;
  sizeMb: number;
  action: StemAction;
}

export interface StemAnalysisResult {
  folder: string;
  files: StemAnalysisEntry[];
}

export interface PackProgress {
  current: number;
  total: number;
  archiveName: string;
}

export interface PackResult {
  folder: string;
  archives: string[];
  totalArchives: number;
}

export interface CreateTestDataResult {
  outputDir: string;
  count: number;
  files: string[];
}

export interface AppConfiguration {
  language: string;
  devMode: boolean;
  defaultMaxSizeMb: number;
  maxSizeLimitMb: number;
  supportedExtensions: string[];
  version: string;
}

export type IPCSuccess<T> = {
  success: true;
  data: T;
};

export type IPCFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type IPCResponse<T> = IPCSuccess<T> | IPCFailure;
