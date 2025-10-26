#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const platformScriptMap = {
  win32: 'package:win',
  linux: 'package:linux',
};

const targetScript = platformScriptMap[process.platform];

if (!targetScript) {
  console.error(`Unsupported platform "${process.platform}". Use pnpm run package:win or pnpm run package:linux instead.`);
  process.exit(1);
}

const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpmExecutable, ['run', targetScript], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
