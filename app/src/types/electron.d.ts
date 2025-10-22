import type {
  AnalyzeResponse,
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
    };
    runtimeConfig: RuntimeConfig;
  }
}

export {};
