import type {
  AnalyzeResponse,
  PackErrorPayload,
  PackProgress,
  PackRequest,
  PackResult,
  PackStatusEvent,
  TestDataResponse,
  UserPrefsAddRecent,
  UserPrefsGet,
  UserPrefsResponse,
  UserPrefsSet
} from '@common/ipc';
import type { RuntimeConfig } from '@common/runtime';
import type { EstimateRequest, EstimateResponse } from '@common/packing/estimator';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      analyzeFolder: (folderPath: string, maxSizeMb: number, locale: string) => Promise<AnalyzeResponse>;
      startPack: (request: PackRequest) => Promise<void>;
      onPackProgress: (callback: (progress: PackProgress) => void) => () => void;
      onPackStatus: (callback: (status: PackStatusEvent) => void) => () => void;
      onPackDone: (callback: (result: PackResult) => void) => () => void;
      onPackError: (callback: (error: PackErrorPayload) => void) => () => void;
      createTestData: (folderPath: string, locale: string) => Promise<TestDataResponse>;
      openExternal: (url: string) => Promise<void>;
      openPath: (path: string) => Promise<void>;
      checkExistingZips: (folderPath: string) => Promise<{ count: number; files: string[] }>;
      estimateZipCount: (request: EstimateRequest) => Promise<EstimateResponse>;
      getUserPrefs: (request?: UserPrefsGet) => Promise<UserPrefsResponse>;
      setUserPrefs: (request: UserPrefsSet) => Promise<void>;
      addRecentArtist: (request: UserPrefsAddRecent) => Promise<void>;
    };
    runtimeConfig: RuntimeConfig;
  }
}

export {};
