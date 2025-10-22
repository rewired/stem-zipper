#!/usr/bin/env node

'use strict';

const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targets = [
  path.join(projectRoot, 'release'),
  path.join(projectRoot, 'dist-electron'),
  path.join(projectRoot, 'dist-renderer'),
];

async function ensureRemoved(target) {
  const label = path.relative(projectRoot, target) || path.basename(target);

  try {
    await fs.stat(target);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`[clean] skipped ${label} (not found)`);
      return;
    }

    console.error(`[clean] failed to inspect ${label}: ${error.message}`);
    throw error;
  }

  try {
    await fs.rm(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 300,
    });
    console.log(`[clean] removed ${label}`);
  } catch (error) {
    console.error(`[clean] failed to remove ${label}: ${error.message}`);
    throw error;
  }
}

async function main() {
  for (const target of targets) {
    try {
      await ensureRemoved(target);
    } catch (error) {
      process.exitCode = 1;
      return;
    }
  }
}

main();
