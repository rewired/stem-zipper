#!/usr/bin/env node
const { spawn } = require('node:child_process');
const process = require('node:process');

const SUPPORTED_LOCALES = new Set([
  'en',
  'de',
  'fr',
  'it',
  'es',
  'pt',
  'da',
  'no',
  'sv',
  'fi',
  'nl',
  'pl',
  'ja',
  'zh',
  'th',
  'ko',
  'cs',
  'ro',
  'uk'
]);
const DEFAULT_LOCALE = 'en';

function matchSupportedLocale(locale) {
  if (typeof locale !== 'string') {
    return undefined;
  }

  const trimmed = locale.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalised = trimmed.toLowerCase();
  if (SUPPORTED_LOCALES.has(normalised)) {
    return normalised;
  }

  const baseMatch = normalised.match(/^[a-z]{2}/);
  if (!baseMatch) {
    return undefined;
  }

  const primary = baseMatch[0];
  if (SUPPORTED_LOCALES.has(primary)) {
    return primary;
  }

  return undefined;
}

function collectLocaleCandidates(values) {
  const candidates = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          candidates.push(entry);
        }
      }
      continue;
    }

    if (typeof value === 'string') {
      const parts = value.split(/[:,;]/);
      for (const part of parts) {
        if (part && part.trim().length > 0) {
          candidates.push(part);
        }
      }
    }
  }

  return candidates;
}

function detectSystemLocale() {
  const locales = [
    process.env.STEM_ZIPPER_LANG,
    process.env.LC_ALL,
    process.env.LC_MESSAGES,
    process.env.LANG,
    process.env.LANGUAGE
  ];

  try {
    const resolved = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) {
      locales.push(resolved);
    }
  } catch (error) {
    // Ignore Intl resolution errors and continue with environment hints.
  }

  const candidates = collectLocaleCandidates(locales);
  for (const candidate of candidates) {
    const match = matchSupportedLocale(candidate);
    if (match) {
      return match;
    }
  }

  return undefined;
}

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
  const directMatch = matchSupportedLocale(raw);
  if (directMatch) {
    return directMatch;
  }

  const systemLocale = detectSystemLocale();
  if (systemLocale) {
    return systemLocale;
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

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  collectLocaleCandidates,
  detectSystemLocale,
  matchSupportedLocale,
  normaliseLanguage,
  parseLanguageArgument,
  resolvePnpmInvocation,
  runDevServer
};
