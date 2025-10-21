import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnalyzeResponse,
  PackProgress,
  PackRequest,
  TestDataResponse
} from '../common/ipc';
import { IPC_CHANNELS } from '../common/ipc';
import type { RuntimeConfig } from '../common/runtime';
import { resolveLocale } from '../common/i18n';

type ProgressListener = (progress: PackProgress) => void;

const runtimeConfig: RuntimeConfig = {
  locale: resolveLocale(process.env.STEM_ZIPPER_LANG, process.env.LC_ALL, process.env.LANG),
  devMode:
    process.env.STEM_ZIPPER_DEV_MODE === '1' || Boolean(process.env.VITE_DEV_SERVER_URL)
};

contextBridge.exposeInMainWorld('runtimeConfig', runtimeConfig);

contextBridge.exposeInMainWorld('electronAPI', {
  async selectFolder(): Promise<string | null> {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER);
    if (!result || result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  },
  analyzeFolder(folderPath: string, maxSizeMb: number, locale: string): Promise<AnalyzeResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.ANALYZE_FOLDER, {
      folderPath,
      maxSizeMb,
      locale
    });
  },
  startPack(request: PackRequest): Promise<number> {
    return ipcRenderer.invoke(IPC_CHANNELS.PACK_FOLDER, request);
  },
  onPackProgress(callback: ProgressListener): () => void {
    const listener = (_event: Electron.IpcRendererEvent, progress: PackProgress) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.PACK_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PACK_PROGRESS, listener);
  },
  createTestData(folderPath: string, locale: string): Promise<TestDataResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.CREATE_TESTDATA, {
      folderPath,
      locale
    });
  }
});
