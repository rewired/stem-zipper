import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { analyzeFolder, createTestData, packFolder } from './services/packaging';
import { ensureValidMaxSize } from '../common/validation';
import { formatPathForDisplay } from '../common/paths';
import { IPC_CHANNELS } from '../common/ipc';
import type { AnalyzeResponse, PackRequest, TestDataRequest } from '../common/ipc';
import { formatMessage, resolveLocale } from '../common/i18n';
import type { RuntimeConfig } from '../common/runtime';

let mainWindow: BrowserWindow | null = null;
let packInProgress = false;
let runtimeConfig: RuntimeConfig | null = null;
let preloadPath: string | null = null;

function getCandidatePreloadPaths(): string[] {
  const appPath = app.getAppPath();
  return [
    path.join(appPath, 'dist-electron', 'preload', 'electron', 'preload.js'),
    path.join(__dirname, '../../preload/electron/preload.js')
  ];
}

async function resolvePreloadPath(): Promise<string> {
  if (preloadPath) {
    return preloadPath;
  }

  const candidates = getCandidatePreloadPaths();
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) {
    preloadPath = found;
    return preloadPath;
  }

  const timeoutMs = 10000;
  const pollIntervalMs = 100;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const resolved = candidates.find((candidate) => fs.existsSync(candidate));
    if (resolved) {
      preloadPath = resolved;
      return preloadPath;
    }
  }

  throw new Error(
    `Preload script is missing. Looked for ${candidates
      .map((candidate) => `"${candidate}"`)
      .join(', ')}.`
  );
}

function computeRuntimeConfig(): RuntimeConfig {
  const preferredLanguages =
    typeof app.getPreferredSystemLanguages === 'function'
      ? app.getPreferredSystemLanguages()
      : [];
  const locale = resolveLocale(
    process.env.STEM_ZIPPER_LANG,
    process.env.LC_ALL,
    process.env.LANG,
    preferredLanguages,
    app.getLocale()
  );
  const devMode =
    process.env.STEM_ZIPPER_DEV_MODE === '1' || Boolean(process.env.VITE_DEV_SERVER_URL);
  const config: RuntimeConfig = {
    locale,
    devMode
  };
  process.env.STEM_ZIPPER_LANG = config.locale;
  process.env.STEM_ZIPPER_DEV_MODE = config.devMode ? '1' : '0';
  return config;
}

function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    runtimeConfig = computeRuntimeConfig();
  }
  return runtimeConfig;
}

async function createWindow(): Promise<void> {
  const config = getRuntimeConfig();
  const preload = await resolvePreloadPath();
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    title: formatMessage(config.locale, 'app_title')
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (config.devMode) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    const pageUrl = url.format({
      pathname: path.join(__dirname, '../../../dist-renderer/index.html'),
      protocol: 'file:',
      slashes: true
    });
    await mainWindow.loadURL(pageUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getWindow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error('Main window is not available');
  }
  return mainWindow;
}

app.whenReady()
  .then(async () => {
    runtimeConfig = computeRuntimeConfig();
    registerIpcHandlers();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((error) => console.error(error));
      }
    });
  })
  .catch((error) => console.error(error));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const config = getRuntimeConfig();
    const window = getWindow();
    return dialog.showOpenDialog(window, {
      title: formatMessage(config.locale, 'select_folder'),
      properties: ['openDirectory']
    });
  });

  ipcMain.handle(
    IPC_CHANNELS.ANALYZE_FOLDER,
    async (_event, args: { folderPath: string; maxSizeMb: number; locale: string }) => {
      const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
      const files = analyzeFolder(args.folderPath, sanitizedMax);
      const response: AnalyzeResponse = {
        files,
        count: files.length,
        maxSizeMb: sanitizedMax
      };
      return response;
    }
  );

  ipcMain.handle(IPC_CHANNELS.PACK_FOLDER, async (event, args: PackRequest) => {
    if (packInProgress) {
      return 0;
    }

    packInProgress = true;
    const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
    const config = getRuntimeConfig();
    const locale = resolveLocale(args.locale, config.locale);
    try {
      const total = await packFolder(args.folderPath, sanitizedMax, locale, (progress) => {
        event.sender.send(IPC_CHANNELS.PACK_PROGRESS, progress);
      });
      return total;
    } catch (error) {
      const fallback = formatMessage(locale, 'error_title');
      const message = error instanceof Error && error.message ? error.message : fallback;
      event.sender.send(IPC_CHANNELS.PACK_PROGRESS, {
        state: 'error',
        current: 0,
        total: 0,
        percent: 0,
        message: 'error',
        errorMessage: message
      });
      throw error;
    } finally {
      packInProgress = false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_TESTDATA, async (_event, args: TestDataRequest) => {
    const config = getRuntimeConfig();
    if (!config.devMode) {
      throw new Error(formatMessage(config.locale, 'testdata_dev_only'));
    }
    const count = await createTestData(args.folderPath);
    return {
      count,
      folderPath: formatPathForDisplay(args.folderPath)
    };
  });
}
