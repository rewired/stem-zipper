#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ARGUMENTS = process.argv.slice(2);

function resolveElectronPackageDir() {
  try {
    const pkgPath = require.resolve('electron/package.json');
    return path.dirname(pkgPath);
  } catch (error) {
    throw new Error('Electron dependency is missing. Run "pnpm install" before starting the desktop shell.');
  }
}

function tryGetElectronBinary() {
  try {
    const electronPath = require('electron');
    if (typeof electronPath === 'string' && fs.existsSync(electronPath)) {
      return electronPath;
    }
    return null;
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('Electron failed to install correctly')) {
      return null;
    }

    throw error;
  }
}

function reinstallElectron(electronDir) {
  const installScript = path.join(electronDir, 'install.js');
  if (!fs.existsSync(installScript)) {
    throw new Error('Electron install script is missing. Remove node_modules and reinstall dependencies.');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [installScript], {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '' }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Electron install script exited with code ${code ?? 'null'}.`));
    });
  });
}

async function ensureElectronBinary() {
  const electronDir = resolveElectronPackageDir();
  const initialPath = tryGetElectronBinary();
  if (initialPath) {
    return initialPath;
  }

  await reinstallElectron(electronDir);
  const restoredPath = tryGetElectronBinary();
  if (restoredPath) {
    return restoredPath;
  }

  throw new Error('Electron binary is still missing after running the installer.');
}

async function main() {
  try {
    const electronBinary = await ensureElectronBinary();
    const child = spawn(electronBinary, ARGUMENTS, {
      stdio: 'inherit',
      env: process.env
    });

    child.on('error', (error) => {
      console.error('[electron] Failed to launch Electron:', error);
      process.exit(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      process.exit(code ?? 0);
    });
  } catch (error) {
    console.error(`[electron] ${error.message}`);
    process.exit(1);
  }
}

main();
