#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit'
  });
  if (result.error) {
    console.error(result.error.message);
  }
  const status = result.status ?? 0;
  if (status !== 0) {
    process.exit(status);
  }
}

const ensure7zipScript = path.join(__dirname, 'ensure-7zip.cjs');
if (fs.existsSync(ensure7zipScript)) {
  run(process.execPath, [ensure7zipScript]);
}

if (process.platform === 'win32') {
  const ps1Script = path.join(__dirname, 'postinstall.ps1');
  if (fs.existsSync(ps1Script)) {
    run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Script]);
  }
  process.exit(0);
}

const shScript = path.join(__dirname, 'postinstall.sh');
if (fs.existsSync(shScript)) {
  run('bash', [shScript]);
}
