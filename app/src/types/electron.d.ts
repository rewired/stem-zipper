import type {
  AnalyzeResponse,
  EstimateRequest,
  EstimateResponse,
  PackProgress,
  PackRequest,
  TestDataResponse
} from '@common/ipc';
import type { RuntimeConfig } from '@common/runtime';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      analyzeFolder: (folderPath: string, maxSizeMb: number, locale: string) => Promise<AnalyzeResponse>;
      startPack: (request: PackRequest) => Promise<number>;
      onPackProgress: (callback: (progress: PackProgress) => void) => () => void;
      createTestData: (folderPath: string, locale: string) => Promise<TestDataResponse>;
      openExternal: (url: string) => Promise<void>;
      openPath: (path: string) => Promise<void>;
      checkExistingZips: (folderPath: string) => Promise<{ count: number; files: string[] }>;
      estimateZipCount: (request: EstimateRequest) => Promise<EstimateResponse>;
    };
    runtimeConfig: RuntimeConfig;
  }
}

export {};
