import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpyInstance } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn()
  }
}));

import { resolve7zBinary } from '../resolve7zBinary';
import { app } from 'electron';

const mockApp = app as unknown as {
  isPackaged: boolean;
  getAppPath: ReturnType<typeof vi.fn> & ((...args: unknown[]) => string);
};

const platformDir = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';
const binaryNames = process.platform === 'win32' ? ['7zz.exe', '7z.exe', '7za.exe'] : ['7zz', '7z', '7za'];
const preferredBinaryName = binaryNames[0];

const processWithResources = process as NodeJS.Process & { resourcesPath?: string };
const createdPaths: string[] = [];
let originalResourcesPath: string | undefined;
let originalPath: string | undefined;
let chmodSpy: SpyInstance<
  Parameters<typeof fs.promises.chmod>,
  ReturnType<typeof fs.promises.chmod>
>;

async function createBinary(baseDir: string, name: string = preferredBinaryName): Promise<string> {
  const binaryDir = path.join(baseDir, 'bin', platformDir, process.arch);
  await fs.promises.mkdir(binaryDir, { recursive: true });
  const binaryPath = path.join(binaryDir, name);
  await fs.promises.writeFile(binaryPath, Buffer.from('binary'));
  createdPaths.push(binaryPath);
  return binaryPath;
}

beforeEach(() => {
  originalResourcesPath = processWithResources.resourcesPath;
  originalPath = process.env.PATH;
  chmodSpy = vi.spyOn(fs.promises, 'chmod').mockResolvedValue(undefined);
  mockApp.getAppPath.mockReturnValue(process.cwd());
});

afterEach(async () => {
  delete process.env.STEM_ZIPPER_7Z_PATH;
  delete process.env.DEBUG_STEM_ZIPPER;
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  mockApp.isPackaged = false;
  mockApp.getAppPath.mockReset();
  if (originalResourcesPath === undefined) {
    Reflect.deleteProperty(processWithResources, 'resourcesPath');
  } else {
    processWithResources.resourcesPath = originalResourcesPath;
  }
  const uniqueDirs = Array.from(new Set(createdPaths.map((filePath) => path.dirname(filePath))));
  for (const dir of uniqueDirs) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  createdPaths.length = 0;
  chmodSpy.mockRestore();
});

describe('resolve7zBinary', () => {
  it('prefers the environment override when present', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-override-'));
    const overridePath = path.join(tempDir, preferredBinaryName);
    await fs.promises.writeFile(overridePath, Buffer.from('custom'));
    process.env.STEM_ZIPPER_7Z_PATH = overridePath;

    const resolved = await resolve7zBinary();

    expect(resolved).toBe(overridePath);
    expect(chmodSpy).toHaveBeenCalledWith(overridePath, 0o755);
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('resolves the packaged binary relative to process.resourcesPath', async () => {
    const resourcesRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-packaged-'));
    processWithResources.resourcesPath = resourcesRoot;
    mockApp.isPackaged = true;

    const binaryPath = await createBinary(resourcesRoot);

    const resolved = await resolve7zBinary();

    expect(resolved).toBe(binaryPath);
    expect(chmodSpy).toHaveBeenCalledWith(binaryPath, 0o755);
    await fs.promises.rm(resourcesRoot, { recursive: true, force: true });
  });

  it('resolves the development binary relative to the app path', async () => {
    const appRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-dev-'));
    mockApp.isPackaged = false;
    mockApp.getAppPath.mockReturnValue(appRoot);

    const binaryPath = await createBinary(path.join(appRoot, 'resources'));

    const resolved = await resolve7zBinary();

    expect(resolved).toBe(binaryPath);
    expect(chmodSpy).toHaveBeenCalledWith(binaryPath, 0o755);
    await fs.promises.rm(appRoot, { recursive: true, force: true });
  });

  it('rejects with the translated error key when no candidates exist', async () => {
    mockApp.isPackaged = true;
    const resourcesRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-missing-'));
    processWithResources.resourcesPath = resourcesRoot;
    const missingOverride = path.join(os.tmpdir(), 'missing-7z');
    process.env.STEM_ZIPPER_7Z_PATH = missingOverride;

    await expect(resolve7zBinary()).rejects.toMatchObject({
      message: 'pack_error_7z_binary_missing',
      meta: {
        attemptedPaths: expect.arrayContaining([path.resolve(missingOverride)])
      }
    });

    await fs.promises.rm(resourcesRoot, { recursive: true, force: true });
  });

  it('falls back to binaries available on the system PATH', async () => {
    const resourcesRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-path-'));
    processWithResources.resourcesPath = resourcesRoot;
    mockApp.isPackaged = true;

    const systemDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-system-'));
    const binaryPath = path.join(systemDir, preferredBinaryName);
    await fs.promises.writeFile(binaryPath, Buffer.from('system'));
    process.env.PATH = `${systemDir}${path.delimiter}${originalPath ?? ''}`;

    await expect(resolve7zBinary()).resolves.toBe(binaryPath);

    await fs.promises.rm(resourcesRoot, { recursive: true, force: true });
    await fs.promises.rm(systemDir, { recursive: true, force: true });
  });

  it('ignores permission errors when adjusting permissions', async () => {
    const resourcesRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-erofs-'));
    processWithResources.resourcesPath = resourcesRoot;
    mockApp.isPackaged = true;

    const binaryPath = await createBinary(resourcesRoot);

    chmodSpy.mockRejectedValueOnce(Object.assign(new Error('read-only'), { code: 'EROFS' }));
    chmodSpy.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'EACCES' }));

    await expect(resolve7zBinary()).resolves.toBe(binaryPath);
    await expect(resolve7zBinary()).resolves.toBe(binaryPath);
    await fs.promises.rm(resourcesRoot, { recursive: true, force: true });
  });

  it('falls back to alternative bundled binary names when the preferred one is unavailable', async () => {
    mockApp.isPackaged = true;
    const resourcesRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-7z-alt-'));
    processWithResources.resourcesPath = resourcesRoot;

    const fallbackName = binaryNames[1] ?? preferredBinaryName;
    const binaryPath = await createBinary(resourcesRoot, fallbackName);

    await expect(resolve7zBinary()).resolves.toBe(binaryPath);

    await fs.promises.rm(resourcesRoot, { recursive: true, force: true });
  });
});
