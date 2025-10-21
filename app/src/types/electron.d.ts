import type {
  AnalyzeResponse,
  PackProgress,
  PackRequest,
  TestDataResponse
} from '@common/ipc';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      analyzeFolder: (folderPath: string, maxSizeMb: number, locale: string) => Promise<AnalyzeResponse>;
      startPack: (request: PackRequest) => Promise<number>;
      onPackProgress: (callback: (progress: PackProgress) => void) => () => void;
      createTestData: (folderPath: string, locale: string) => Promise<TestDataResponse>;
    };
  }
}

export {};
