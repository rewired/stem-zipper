import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import minimist from 'minimist';
import {
  DEFAULT_MAX_SIZE_MB,
  LANGUAGE_CODES,
  MAX_SIZE_LIMIT_MB,
  SUPPORTED_EXTENSIONS,
  VERSION
} from '@common/constants';
import type {
  AppConfiguration,
  CreateTestDataResult,
  IPCResponse,
  PackProgress,
  PackResult,
  StemAnalysisResult
} from '@common/types';
import {
  analyzeDirectory,
  createTestData,
  handleServiceCall,
  packDirectory,
  sanitizeMaxSize
} from './stemProcessor';

let mainWindow: BrowserWindow | null = null;

const argv = minimist(process.argv.slice(app.isPackaged ? 1 : 2), {
  boolean: ['dev'],
  string: ['lang']
});

const devMode = Boolean(argv.dev);

const resolveLanguage = () => {
  const requested = typeof argv.lang === 'string' ? argv.lang.toLowerCase() : undefined;
  if (requested && LANGUAGE_CODES.includes(requested as (typeof LANGUAGE_CODES)[number])) {
    return requested;
  }
  const locale = app.getLocale();
  const short = locale ? locale.slice(0, 2).toLowerCase() : 'en';
  if (LANGUAGE_CODES.includes(short as (typeof LANGUAGE_CODES)[number])) {
    return short;
  }
  return 'en';
};

const configuration: AppConfiguration = {
  language: resolveLanguage(),
  devMode,
  defaultMaxSizeMb: DEFAULT_MAX_SIZE_MB,
  maxSizeLimitMb: MAX_SIZE_LIMIT_MB,
  supportedExtensions: SUPPORTED_EXTENSIONS,
  version: VERSION
};

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';

  if (isDev) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error('Failed to create main window', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error('Failed to recreate main window', error);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('stem:get-config', () => configuration);

ipcMain.handle('dialog:choose-directory', async () => {
  if (!mainWindow) {
    return null;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('stem:analyze', async (_event, payload: { folder: string; maxSizeMb: number }): Promise<IPCResponse<StemAnalysisResult>> => {
  const maxSize = sanitizeMaxSize(payload.maxSizeMb);
  return handleServiceCall(() => analyzeDirectory(payload.folder, maxSize));
});

ipcMain.handle(
  'stem:pack',
  async (event, payload: { folder: string; maxSizeMb: number }): Promise<IPCResponse<PackResult>> => {
    const maxSize = sanitizeMaxSize(payload.maxSizeMb);
    return handleServiceCall(async () => {
      const result = await packDirectory(payload.folder, maxSize, (progress: PackProgress) => {
        event.sender.send('stem:progress', progress);
      });
      return result;
    });
  }
);

ipcMain.handle(
  'stem:create-testdata',
  async (_event, payload: { outputDir: string; count?: number }): Promise<IPCResponse<CreateTestDataResult>> => {
    const count = payload.count && payload.count > 0 ? payload.count : undefined;
    return handleServiceCall(() => createTestData(payload.outputDir, count));
  }
);
