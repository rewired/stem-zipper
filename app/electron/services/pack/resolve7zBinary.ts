import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const ENV_OVERRIDE = 'STEM_ZIPPER_7Z_PATH';
const DEBUG_ENV = 'DEBUG_STEM_ZIPPER';

const PLATFORM_DIR_MAP: Record<NodeJS.Platform, string> = {
  aix: 'linux',
  android: 'linux',
  darwin: 'mac',
  freebsd: 'linux',
  haiku: 'linux',
  linux: 'linux',
  openbsd: 'linux',
  sunos: 'linux',
  win32: 'win',
  cygwin: 'win',
  netbsd: 'linux'
};

function logDebug(message: string, ...args: unknown[]): void {
  if (process.env[DEBUG_ENV] === '1') {
    console.debug('[stem-zipper]', message, ...args);
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
}

async function ensureExecutablePermissions(filePath: string): Promise<void> {
  if (process.platform === 'win32') {
    return;
  }
  try {
    await fs.promises.chmod(filePath, 0o755);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EROFS') {
      logDebug('Skipping chmod on read-only filesystem', filePath);
      return;
    }
    console.warn('Failed to adjust 7z binary permissions', filePath, error);
  }
}

function resolvePlatformDir(): string {
  return PLATFORM_DIR_MAP[process.platform] ?? process.platform;
}

function resolveBinaryName(): string {
  return process.platform === 'win32' ? '7zz.exe' : '7zz';
}

function resolveBaseCandidates(isPackaged: boolean): string[] {
  const platformDir = resolvePlatformDir();
  const arch = process.arch;
  const binaryName = resolveBinaryName();

  const candidates = new Set<string>();

  if (isPackaged) {
    const packagedBase = path.join(process.resourcesPath, 'bin');
    candidates.add(path.join(packagedBase, platformDir, arch, binaryName));
    candidates.add(path.join(packagedBase, platformDir, binaryName));
  } else {
    const appPath = app.getAppPath();
    const devBases = [
      path.join(appPath, 'resources', 'bin'),
      path.join(appPath, '..', 'resources', 'bin'),
      path.join(appPath, '..', '..', 'resources', 'bin')
    ];
    for (const base of devBases) {
      candidates.add(path.join(base, platformDir, arch, binaryName));
      candidates.add(path.join(base, platformDir, binaryName));
    }
  }

  return Array.from(candidates);
}

function resolveCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env[ENV_OVERRIDE];
  if (override) {
    candidates.push(path.resolve(override));
  }
  const baseCandidates = resolveBaseCandidates(app.isPackaged);
  candidates.push(...baseCandidates);
  return candidates;
}

export async function resolve7zBinary(): Promise<string> {
  const candidates = resolveCandidates();
  const attemptedPaths: string[] = [];

  for (const candidate of candidates) {
    attemptedPaths.push(candidate);
    logDebug('Inspecting 7z binary candidate', candidate);
    try {
      const stats = await fs.promises.stat(candidate);
      if (!stats.isFile()) {
        logDebug('Skipping non-file 7z candidate', candidate);
        continue;
      }
      await ensureExecutablePermissions(candidate);
      logDebug('Resolved 7z binary', candidate);
      return candidate;
    } catch (error) {
      if (isErrnoException(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
        continue;
      }
      console.warn('Failed to inspect 7z binary candidate', candidate, error);
    }
  }

  logDebug('Unable to resolve 7z binary', attemptedPaths);
  const resolutionError = new Error('pack_error_7z_binary_missing') as Error & {
    meta?: { attemptedPaths: string[] };
  };
  resolutionError.meta = { attemptedPaths };
  throw resolutionError;
}
