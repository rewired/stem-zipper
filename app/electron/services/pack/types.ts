import { SUPPORTED_EXTENSIONS } from '../../../common/constants';
import type { LocaleKey } from '../../../common/i18n';
import type { PackMethod, PackToast } from '../../../common/ipc';
import type { NormalizedPackMetadata } from '../packMetadata';

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export type ProgressState = 'preparing' | 'packing' | 'finalizing' | 'done' | 'error';

export type ProgressMessage =
  | 'pack_progress_preparing'
  | 'pack_progress_packing'
  | 'pack_progress_finalizing'
  | 'pack_progress_done'
  | 'pack_progress_error';

export interface ProgressEvent {
  state: ProgressState;
  current: number;
  total: number;
  percent: number;
  message: ProgressMessage;
  currentArchive?: string;
  errorMessage?: string;
}

export interface ProgressReporter {
  start(info: { total: number; message?: ProgressMessage }): void;
  setTotal(total: number): void;
  addToTotal(delta: number): void;
  tick(info?: { state?: Exclude<ProgressState, 'done' | 'error'>; message?: ProgressMessage; percent?: number; currentArchive?: string }): void;
  fileStart(info?: {
    state?: Exclude<ProgressState, 'done' | 'error'>;
    message?: ProgressMessage;
    currentArchive?: string;
  }): void;
  fileDone(info?: {
    state?: Exclude<ProgressState, 'done' | 'error'>;
    message?: ProgressMessage;
    currentArchive?: string;
  }): void;
  done(info?: { message?: ProgressMessage }): void;
  error(info: { error: Error | string; message?: ProgressMessage }): void;
}

export interface SizedFile {
  path: string;
  size: number;
  extension: SupportedExtension;
}

export interface ExtraArchiveEntry {
  name: string;
  content: string | Buffer;
  compress?: boolean;
}

export interface PackOptions {
  method: PackMethod;
  maxArchiveSizeMB: number;
  outputDir: string;
  files: string[];
  locale: LocaleKey;
  metadata: NormalizedPackMetadata;
  splitStereoThresholdMB?: number;
  splitStereoFiles?: string[];
}

export interface StrategyResult {
  archives: string[];
}

export interface PackStrategyContext {
  files: SizedFile[];
  options: PackOptions;
  progress: ProgressReporter;
  extras: ExtraArchiveEntry[];
  emitToast?: (toast: PackToast) => void;
  registerTempFile: (filePath: string) => void;
}

export type PackStrategy = (context: PackStrategyContext) => Promise<StrategyResult>;
