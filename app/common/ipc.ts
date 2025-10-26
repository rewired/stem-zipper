import type { LocaleKey, TranslationKey } from './i18n';
import type { EstimateFileKind } from './packing/estimator';

export const IPC_CHANNELS = {
  SELECT_FOLDER: 'dialog:select-folder',
  ANALYZE_FOLDER: 'analyze-folder',
  PACK_FOLDER: 'pack-folder',
  PACK_PROGRESS: 'pack-progress',
  PACK_STATUS: 'pack-status',
  CREATE_TESTDATA: 'create-testdata',
  OPEN_EXTERNAL: 'open-external',
  OPEN_PATH: 'open-path',
  CHECK_EXISTING_ZIPS: 'check-existing-zips',
  ESTIMATE: 'estimator:estimate',
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',
  PREFS_ADD_RECENT: 'prefs:addRecent'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type RendererFileAction = 'split_mono' | 'split_zip' | 'normal';

export interface FileEntry {
  name: string;
  sizeMb: number;
  action: RendererFileAction;
  path: string;
  sizeBytes: number;
  kind: EstimateFileKind;
  stereo?: boolean;
}

export interface AnalyzeResponse {
  files: FileEntry[];
  count: number;
  maxSizeMb: number;
}

export type LicenseId = 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC-BY-NC-4.0';

export interface PackMetadata {
  title: string;
  artist: string;
  license: { id: LicenseId };
  album?: string;
  bpm?: string;
  key?: string;
  attribution?: string;
  links?: { artist_url?: string; contact_email?: string };
}

export type PackMethod = 'zip_best_fit' | 'seven_z_split';

export interface PackRequest {
  folderPath: string;
  maxSizeMb: number;
  locale: string;
  packMetadata: PackMetadata;
  method?: PackMethod;
}

export type PackState = 'idle' | 'analyzing' | 'packing' | 'finished' | 'error';

export type PackToastLevel = 'info' | 'warning';

export interface PackToast {
  id: string;
  level: PackToastLevel;
  messageKey: TranslationKey;
  params?: Record<string, string>;
}

export interface PackProgress {
  state: PackState;
  current: number;
  total: number;
  percent: number;
  message: string;
  currentZip?: string;
  errorMessage?: string;
}

export type PackStatusEvent =
  | {
      type: 'toast';
      toast: PackToast;
    };

export interface TestDataRequest {
  folderPath: string;
  locale: string;
}

export interface TestDataResponse {
  count: number;
  folderPath: string;
}

export interface FolderSelectionResponse {
  canceled: boolean;
  filePaths: string[];
}

export interface CheckExistingZipsResponse {
  count: number;
  files: string[];
}

export type UserPrefsGet = Record<string, never>;

export type UserPrefsSet = {
  default_artist?: string;
  default_artist_url?: string;
  default_contact_email?: string;
};

export type UserPrefsAddRecent = { artist: string };

export interface UserPrefsResponse {
  default_artist?: string;
  default_artist_url?: string;
  default_contact_email?: string;
  recent_artists?: string[];
}
