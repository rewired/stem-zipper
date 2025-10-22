export const IPC_CHANNELS = {
  SELECT_FOLDER: 'dialog:select-folder',
  ANALYZE_FOLDER: 'analyze-folder',
  PACK_FOLDER: 'pack-folder',
  PACK_PROGRESS: 'pack-progress',
  PACK_STATUS: 'pack-status',
  CREATE_TESTDATA: 'create-testdata',
  OPEN_EXTERNAL: 'open-external',
  OPEN_PATH: 'open-path',
  CHECK_EXISTING_ZIPS: 'check-existing-zips'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type RendererFileAction = 'split_mono' | 'split_zip' | 'normal';

export interface FileEntry {
  name: string;
  sizeMb: number;
  action: RendererFileAction;
  path: string;
}

export interface AnalyzeResponse {
  files: FileEntry[];
  count: number;
  maxSizeMb: number;
}

export interface PackRequest {
  folderPath: string;
  maxSizeMb: number;
  locale: string;
}

export type PackState = 'idle' | 'analyzing' | 'packing' | 'finished' | 'error';

export interface PackProgress {
  state: PackState;
  current: number;
  total: number;
  percent: number;
  message: string;
  currentZip?: string;
  errorMessage?: string;
}

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
