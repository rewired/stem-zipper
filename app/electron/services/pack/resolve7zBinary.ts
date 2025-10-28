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

const IGNORED_CHMOD_ERROR_CODES = new Set(['EROFS', 'EACCES', 'EPERM', 'ENOTSUP', 'EINVAL']);

async function ensureExecutablePermissions(filePath: string): Promise<void> {
  try {
    await fs.promises.chmod(filePath, 0o755);
  } catch (error) {
    if (isErrnoException(error)) {
      const { code } = error;
      if (code && IGNORED_CHMOD_ERROR_CODES.has(code)) {
        logDebug('Skipping chmod on read-only or permission-restricted filesystem', filePath, code);
        return;
      }
    }
    console.warn('Failed to adjust 7z binary permissions', filePath, error);
  }
}

function resolvePlatformDir(): string {
  return PLATFORM_DIR_MAP[process.platform] ?? process.platform;
}

function resolveBinaryNames(): string[] {
  if (process.platform === 'win32') {
    return ['7zz.exe', '7z.exe', '7za.exe'];
  }
  return ['7zz', '7z', '7za'];
}

function resolveBaseCandidates(isPackaged: boolean): string[] {
  const platformDir = resolvePlatformDir();
  const arch = process.arch;
  const binaryNames = resolveBinaryNames();

  const candidates = new Set<string>();

  const appendCandidates = (base: string) => {
    for (const name of binaryNames) {
      candidates.add(path.join(base, platformDir, arch, name));
      candidates.add(path.join(base, platformDir, name));
    }
  };

  if (isPackaged) {
    const packagedBase = path.join(process.resourcesPath, 'bin');
    appendCandidates(packagedBase);
  } else {
    const appPath = app.getAppPath();
    const devBases = [
      path.join(appPath, 'resources', 'bin'),
      path.join(appPath, '..', 'resources', 'bin'),
      path.join(appPath, '..', '..', 'resources', 'bin')
    ];
    for (const base of devBases) {
      appendCandidates(base);
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
  const systemCandidates = resolveSystemCandidates();
  candidates.push(...systemCandidates);
  return candidates;
}

function resolveSystemCandidates(): string[] {
  const pathEnv = process.env.PATH;
  if (!pathEnv) {
    return [];
  }

  const binaryNames = new Set<string>(resolveBinaryNames());

  const systemCandidates = new Set<string>();
  for (const segment of pathEnv.split(path.delimiter)) {
    if (!segment) {
      continue;
    }
    const dir = path.resolve(segment);
    for (const name of binaryNames) {
      systemCandidates.add(path.join(dir, name));
    }
  }

  return Array.from(systemCandidates);
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
