import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import url from 'node:url';
import { analyzeFolder, createTestData, packFolder } from './services/packaging';
import { ensureValidMaxSize } from '@common/validation';
import { formatPathForDisplay } from '@common/paths';
import { IPC_CHANNELS } from '@common/ipc';
import type { AnalyzeResponse, PackRequest, TestDataRequest } from '@common/ipc';

let mainWindow: BrowserWindow | null = null;
let packInProgress = false;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    title: 'Stem ZIPper'
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const pageUrl = url.format({
      pathname: path.join(__dirname, '../../dist-renderer/index.html'),
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

app.whenReady().then(() => {
  createWindow().catch((error) => console.error(error));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => console.error(error));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
  const window = getWindow();
  return dialog.showOpenDialog(window, {
    title: 'Select Folder',
    properties: ['openDirectory']
  });
});

ipcMain.handle(IPC_CHANNELS.ANALYZE_FOLDER, async (_event, args: { folderPath: string; maxSizeMb: number; locale: string }) => {
  const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
  const files = analyzeFolder(args.folderPath, sanitizedMax);
  const response: AnalyzeResponse = {
    files,
    count: files.length,
    maxSizeMb: sanitizedMax
  };
  return response;
});

ipcMain.handle(IPC_CHANNELS.PACK_FOLDER, async (event, args: PackRequest) => {
  if (packInProgress) {
    return 0;
  }

  packInProgress = true;
  const sanitizedMax = ensureValidMaxSize(args.maxSizeMb);
  try {
    const total = await packFolder(args.folderPath, sanitizedMax, (progress) => {
      event.sender.send(IPC_CHANNELS.PACK_PROGRESS, progress);
    });
    return total;
  } catch (error) {
    event.sender.send(IPC_CHANNELS.PACK_PROGRESS, {
      state: 'error',
      current: 0,
      total: 0,
      percent: 0,
      message: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  } finally {
    packInProgress = false;
  }
});

ipcMain.handle(IPC_CHANNELS.CREATE_TESTDATA, async (_event, args: TestDataRequest) => {
  const count = await createTestData(args.folderPath);
  return {
    count,
    folderPath: formatPathForDisplay(args.folderPath)
  };
});
