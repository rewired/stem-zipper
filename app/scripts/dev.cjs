#!/usr/bin/env node
const { spawn } = require('node:child_process');
const process = require('node:process');

const SUPPORTED_LOCALES = new Set(['en', 'de', 'fr', 'it', 'es', 'pt']);
const DEFAULT_LOCALE = 'en';

function parseLanguageArgument(argv) {
  let language;
  const passthrough = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--') {
      // Preserve the delimiter but continue parsing the remaining arguments.
      continue;
    }

    if (argument.startsWith('--lang=')) {
      language = argument.split('=')[1];
      continue;
    }

    if (argument.startsWith('--language=')) {
      language = argument.split('=')[1];
      continue;
    }

    if (argument === '--lang' || argument === '--language') {
      const next = argv[index + 1];
      if (typeof next === 'string') {
        language = next;
        index += 1;
        continue;
      }
    }

    if (!argument.startsWith('-') && !language) {
      language = argument;
      continue;
    }

    passthrough.push(argument);
  }

  return { language, passthrough };
}

function normaliseLanguage(raw) {
  if (!raw) {
    return DEFAULT_LOCALE;
  }

  const trimmed = raw.trim().toLowerCase();
  if (SUPPORTED_LOCALES.has(trimmed)) {
    return trimmed;
  }

  return DEFAULT_LOCALE;
}

function resolvePnpmInvocation(baseArgs) {
  const npmExecPath = process.env.npm_execpath;
  const npmNodeExecPath = process.env.npm_node_execpath;

  if (npmExecPath && npmNodeExecPath) {
    return {
      command: npmNodeExecPath,
      args: [npmExecPath, ...baseArgs]
    };
  }

  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: baseArgs
  };
}

function runDevServer(locale, passthroughArgs) {
  process.env.STEM_ZIPPER_LANG = locale;
  console.log(`[dev] Starting Vite/Electron in locale "${locale}".`);

  const pnpmArgs = ['run', 'dev:start'];

  if (passthroughArgs.length > 0) {
    pnpmArgs.push('--', ...passthroughArgs);
  }

  const { command, args } = resolvePnpmInvocation(pnpmArgs);

  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (error) => {
    console.error('[dev] Failed to launch the development runners:', error);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

function main() {
  const argv = process.argv.slice(2);
  const { language, passthrough } = parseLanguageArgument(argv);
  const locale = normaliseLanguage(language);
  runDevServer(locale, passthrough);
}

main();
