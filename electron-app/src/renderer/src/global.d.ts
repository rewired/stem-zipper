import type {
  AppConfiguration,
  CreateTestDataResult,
  IPCResponse,
  PackResult,
  StemAnalysisResult
} from '@common/types';

interface PackPayload {
  folder: string;
  maxSizeMb: number;
}

interface AnalyzePayload extends PackPayload {}

interface TestDataPayload {
  outputDir: string;
  count?: number;
}

declare global {
  interface Window {
    stemZipper: {
      chooseDirectory: () => Promise<string | null>;
      getConfiguration: () => Promise<AppConfiguration>;
      analyzeDirectory: (payload: AnalyzePayload) => Promise<IPCResponse<StemAnalysisResult>>;
      packDirectory: (payload: PackPayload) => Promise<IPCResponse<PackResult>>;
      createTestData: (payload: TestDataPayload) => Promise<IPCResponse<CreateTestDataResult>>;
      onProgress: (callback: (progress: import('@common/types').PackProgress) => void) => () => void;
    };
  }
}

export {};
