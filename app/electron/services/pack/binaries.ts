import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const ENV_OVERRIDE = 'STEM_ZIPPER_7Z_PATH';

function resolveBasePath(): string {
  const override = process.env[ENV_OVERRIDE];
  if (override) {
    return override;
  }

  const platform = process.platform;
  const base =
    process.env.NODE_ENV === 'development'
      ? path.join(app.getAppPath(), 'resources', 'bin')
      : path.join(process.resourcesPath, 'bin');

  if (platform === 'win32') {
    return path.join(base, 'win', '7z.exe');
  }
  if (platform === 'darwin') {
    return path.join(base, 'mac', '7zz');
  }
  return path.join(base, 'linux', '7zz');
}

export function resolve7zBinary(): string {
  const resolved = resolveBasePath();
  if (!fs.existsSync(resolved)) {
    throw new Error('error_7z_binary_missing');
  }
  return resolved;
}
