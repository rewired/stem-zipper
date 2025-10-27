#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function stageBinaries() {
  const appRoot = path.join(__dirname, '..');
  const resourcesRoot = path.join(appRoot, 'resources', 'bin');
  const moduleRoot = path.dirname(require.resolve('7zip-bin/package.json'));

  const platformDirs = ['win', 'linux', 'mac'];
  const staged = [];

  for (const platform of platformDirs) {
    const platformSource = path.join(moduleRoot, platform);
    if (!(await fileExists(platformSource))) {
      continue;
    }

    const platformEntries = await fs.readdir(platformSource, { withFileTypes: true });
    for (const archEntry of platformEntries) {
      if (!archEntry.isDirectory()) {
        continue;
      }

      const arch = archEntry.name;
      const archSource = path.join(platformSource, arch);
      const archTarget = path.join(resourcesRoot, platform, arch);
      await fs.mkdir(archTarget, { recursive: true });

      const archFiles = await fs.readdir(archSource, { withFileTypes: true });
      for (const fileEntry of archFiles) {
        if (!fileEntry.isFile()) {
          continue;
        }

        const name = fileEntry.name;
        if (!name.startsWith('7z')) {
          continue;
        }

        const sourcePath = path.join(archSource, name);
        const targetPath = path.join(archTarget, name);
        await fs.copyFile(sourcePath, targetPath);
        if (!targetPath.endsWith('.exe')) {
          await fs.chmod(targetPath, 0o755).catch((error) => {
            if (error && (error.code === 'EROFS' || error.code === 'EACCES' || error.code === 'EPERM')) {
              return;
            }
            throw error;
          });
        }
        staged.push({ platform, arch, name });
      }
    }
  }

  return staged;
}

(async () => {
  try {
    const staged = await stageBinaries();
    const grouped = staged.map(({ platform, arch, name }) => `${platform}/${arch}/${name}`);
    const unique = Array.from(new Set(grouped)).sort();
    if (unique.length > 0) {
      console.log(`[stem-zipper] staged ${unique.length} 7zip binaries:\n - ${unique.join('\n - ')}`);
    } else {
      console.warn('[stem-zipper] no 7zip binaries were staged from 7zip-bin');
    }
  } catch (error) {
    console.error('[stem-zipper] failed to stage 7zip binaries', error);
    process.exit(1);
  }
})();
