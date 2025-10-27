import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { analyzeFolder, createTestData, pack } from './services/pack';
import { ensureValidMaxSize } from '../common/validation';
import { formatPathForDisplay } from '../common/paths';
import { IPC_CHANNELS } from '../common/ipc';
import type { AnalyzeResponse, PackRequest, TestDataRequest } from '../common/ipc';
import { formatMessage, resolveLocale, type TranslationKey } from '../common/i18n';
import type { RuntimeConfig } from '../common/runtime';
import { APP_VERSION } from '../common/version';
import { estimateZipCount, type EstimateRequest } from '../common/packing/estimator';
import type { PackingPlanRequest } from '../common/ipc/contracts';
import { estimatePackingPlan } from './services/packEstimator';
import { getUserPreferences, setUserPreferences, addRecentArtist } from './services/preferences';
import { normalizePackMetadata } from './services/packMetadata';
import { installGracefulExit } from './gracefulExit';

let mainWindow: BrowserWindow | null = null;
let packInProgress = false;
let runtimeConfig: RuntimeConfig | null = null;
let preloadPath: string | null = null;

function parseArgLang(): string | undefined {
  const args = process.argv.slice(1);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    if (a.startsWith('--lang=')) {
      const v = a.split('=')[1];
      if (v) return v;
    }
    if (a === '--lang') {
      const v = args[i + 1];
      if (v && !v.startsWith('-')) return v;
    }
  }
  return undefined;
}

// Apply CLI language early so both main and preload can see it via env
const cliLang = parseArgLang();
if (cliLang) {
  process.env.STEM_ZIPPER_LANG = cliLang;
}

installGracefulExit();

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
  const systemLocale = typeof app.getLocale === 'function' ? app.getLocale() : undefined;
  const locale = resolveLocale(
    process.env.STEM_ZIPPER_LANG,
    process.env.LC_ALL,
    systemLocale,
    preferredLanguages,
    process.env.LANG
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
    width: 1600,
    height: 1000,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    title: `${formatMessage(config.locale, 'app_title')} ${APP_VERSION}`
  });

  Menu.setApplicationMenu(null);

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
      title: formatMessage(config.locale, 'app_select_folder_label'),
      properties: ['openDirectory']
    });
  });

  ipcMain.handle(
    IPC_CHANNELS.ANALYZE_FOLDER,
    async (_event, args: { folderPath: string; maxSizeMb: number; locale: string }) => {
      const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
      const files = await analyzeFolder(args.folderPath, sanitizedMax);
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
      return;
    }

    packInProgress = true;
    const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
    const config = getRuntimeConfig();
    const locale = resolveLocale(args.locale, config.locale);
    let normalizedMetadata;
    try {
      normalizedMetadata = normalizePackMetadata(args.packMetadata);
    } catch (error) {
      console.warn('Pack request rejected due to incomplete metadata', error);
      const friendly = formatMessage(locale, 'btn_pack_disabled_missing_required');
      packInProgress = false;
      throw new Error(friendly);
    }
    try {
      const entries = await fs.promises.readdir(args.folderPath, { withFileTypes: true });
      const existing = entries.filter((entry) => entry.isFile() && /^stems-.*\.(zip|7z(\.\d{3})?)$/i.test(entry.name));
      if (existing.length > 0) {
        const window = getWindow();
        const { response } = await dialog.showMessageBox(window, {
          type: 'warning',
          buttons: [formatMessage(locale, 'pack_action_start'), formatMessage(locale, 'common_close')],
          defaultId: 0,
          cancelId: 1,
          title: formatMessage(locale, 'dialog_overwrite_title'),
          message: formatMessage(locale, 'dialog_overwrite_title'),
          detail: formatMessage(locale, 'dialog_overwrite_text')
        });
        if (response !== 0) {
          packInProgress = false;
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to check for existing archives before packing', error);
    }

    try {
      const result = await pack({
        options: {
          method: args.method ?? 'zip_best_fit',
          maxArchiveSizeMB: sanitizedMax,
          outputDir: args.folderPath,
          files: Array.isArray(args.files) ? args.files : [],
          locale,
          metadata: normalizedMetadata,
          splitStereoThresholdMB: args.splitStereoThresholdMb
        },
        onProgress: (progress) => {
          event.sender.send(IPC_CHANNELS.PACK_PROGRESS, progress);
        },
        emitStatus: (status) => {
          event.sender.send(IPC_CHANNELS.PACK_STATUS, status);
        }
      });
      event.sender.send(IPC_CHANNELS.PACK_DONE, {
        archives: result.archives.map((archivePath) => formatPathForDisplay(archivePath)),
        method: args.method ?? 'zip_best_fit'
      });
    } catch (error) {
      const code = error instanceof Error && error.message ? error.message : 'pack_error_unknown';
      let message: string;
      try {
        message = formatMessage(locale, code as TranslationKey);
      } catch (formatError) {
        console.warn('Failed to localize pack error message', code, formatError);
        message = code;
      }
      event.sender.send(IPC_CHANNELS.PACK_ERROR, { message, code });
      console.error('Packing failed', error);
    } finally {
      packInProgress = false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_TESTDATA, async (_event, args: TestDataRequest) => {
    const config = getRuntimeConfig();
    if (!config.devMode) {
      throw new Error(formatMessage(config.locale, 'dev_error_dev_only'));
    }
    const count = await createTestData(args.folderPath);
    return {
      count,
      folderPath: formatPathForDisplay(args.folderPath)
    };
  });

  ipcMain.handle(IPC_CHANNELS.ESTIMATE, async (_event, args: EstimateRequest) => {
    try {
      return estimateZipCount(args);
    } catch (error) {
      console.error('Failed to compute ZIP estimate', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ESTIMATE_PLAN, async (_event, args: PackingPlanRequest) => {
    try {
      return estimatePackingPlan(args);
    } catch (error) {
      console.error('Failed to compute packing plan', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREFS_GET, () => getUserPreferences());

  ipcMain.handle(IPC_CHANNELS.PREFS_SET, (_event, request) => {
    return setUserPreferences(request ?? {});
  });

  ipcMain.handle(IPC_CHANNELS.PREFS_ADD_RECENT, (_event, request) => {
    if (request && typeof request.artist === 'string') {
      return addRecentArtist(request);
    }
    return undefined;
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: string) => {
    if (typeof url !== 'string' || url.trim().length === 0) {
      return;
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_PATH, async (_event, targetPath: string) => {
    if (typeof targetPath !== 'string' || targetPath.trim().length === 0) {
      return;
    }
    try {
      // shell.openPath opens folders/files in the OS file manager
      const result = await shell.openPath(targetPath);
      if (result) {
        // result is a non-empty error string on failure
        throw new Error(result);
      }
    } catch (error) {
      console.error('Failed to open path', targetPath, error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_EXISTING_ZIPS, async (_event, folderPath: string) => {
    try {
      if (typeof folderPath !== 'string' || folderPath.trim().length === 0) {
        return { count: 0, files: [] };
      }
      const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((name) => /^stems-.*\.zip$/i.test(name));
      const preview = files.slice(0, 10);
      return { count: files.length, files: preview };
    } catch (error) {
      console.error('Failed to scan for existing ZIPs', folderPath, error);
      return { count: 0, files: [] };
    }
  });
}
