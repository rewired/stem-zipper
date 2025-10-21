import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfiguration,
  CreateTestDataResult,
  IPCResponse,
  PackProgress,
  PackResult,
  StemAnalysisResult
} from '@common/types';

interface PackPayload {
  folder: string;
  maxSizeMb: number;
}

interface TestDataPayload {
  outputDir: string;
  count?: number;
}

interface AnalyzePayload {
  folder: string;
  maxSizeMb: number;
}

type Unsubscribe = () => void;

declare global {
  interface Window {
    stemZipper: {
      chooseDirectory: () => Promise<string | null>;
      getConfiguration: () => Promise<AppConfiguration>;
      analyzeDirectory: (payload: AnalyzePayload) => Promise<IPCResponse<StemAnalysisResult>>;
      packDirectory: (payload: PackPayload) => Promise<IPCResponse<PackResult>>;
      createTestData: (payload: TestDataPayload) => Promise<IPCResponse<CreateTestDataResult>>;
      onProgress: (callback: (progress: PackProgress) => void) => Unsubscribe;
    };
  }
}

const api = {
  chooseDirectory: () => ipcRenderer.invoke('dialog:choose-directory') as Promise<string | null>,
  getConfiguration: () => ipcRenderer.invoke('stem:get-config') as Promise<AppConfiguration>,
  analyzeDirectory: (payload: AnalyzePayload) => ipcRenderer.invoke('stem:analyze', payload) as Promise<IPCResponse<StemAnalysisResult>>,
  packDirectory: (payload: PackPayload) => ipcRenderer.invoke('stem:pack', payload) as Promise<IPCResponse<PackResult>>,
  createTestData: (payload: TestDataPayload) => ipcRenderer.invoke('stem:create-testdata', payload) as Promise<IPCResponse<CreateTestDataResult>>,
  onProgress: (callback: (progress: PackProgress) => void): Unsubscribe => {
    const channel = 'stem:progress';
    const listener = (_event: Electron.IpcRendererEvent, progress: PackProgress) => {
      callback(progress);
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('stemZipper', api);
