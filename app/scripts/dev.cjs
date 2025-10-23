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

  const forwardedArgs = Array.isArray(passthroughArgs) ? passthroughArgs : [];

  const managedChildren = new Set();
  let shuttingDown = false;
  let exitCode;
  let exitSignal;

  function maybeExitProcess() {
    if (managedChildren.size > 0) {
      return;
    }

    if (exitSignal) {
      process.kill(process.pid, exitSignal);
      return;
    }

    process.exit(exitCode ?? 0);
  }

  function stopAllChildren(signal) {
    if (!shuttingDown) {
      shuttingDown = true;
      exitSignal = exitSignal ?? signal;
      for (const child of managedChildren) {
        if (!child.killed) {
          child.kill(signal ?? 'SIGTERM');
        }
      }
    }

    maybeExitProcess();
  }

  function handleChildExit(label, child, code, signal) {
    managedChildren.delete(child);

    if (shuttingDown) {
      maybeExitProcess();
      return;
    }

    if (signal) {
      exitSignal = signal;
      stopAllChildren(signal);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      console.error(`[dev:${label}] exited with code ${code}.`);
      exitCode = code;
      stopAllChildren();
      return;
    }

    // When the Electron shell closes, shut down the remaining workers gracefully.
    exitCode = code ?? exitCode ?? 0;
    stopAllChildren();
  }

  function launchPnpmScript(label, baseArgs) {
    const { command, args } = resolvePnpmInvocation(baseArgs);
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env
    });

    managedChildren.add(child);

    child.on('exit', (code, signal) => {
      handleChildExit(label, child, code, signal);
    });

    child.on('error', (error) => {
      if (shuttingDown) {
        return;
      }

      managedChildren.delete(child);
      console.error(`[dev:${label}] failed to start:`, error);
      exitCode = 1;
      stopAllChildren();
    });

    return child;
  }

  const watchers = [
    ['dev:main', ['run', 'dev:main']],
    ['dev:preload', ['run', 'dev:preload']],
    ['dev:renderer', ['run', 'dev:renderer']]
  ];

  for (const [label, args] of watchers) {
    launchPnpmScript(label, args);
  }

  const electronArgs = ['run', 'electron'];
  if (forwardedArgs.length > 0) {
    electronArgs.push('--', ...forwardedArgs);
  }
  launchPnpmScript('electron', electronArgs);

  const handleSignal = (signal) => {
    exitSignal = signal;
    stopAllChildren(signal);
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
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
