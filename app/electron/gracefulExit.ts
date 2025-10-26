import { app as electronApp } from 'electron';
import process from 'node:process';
import type { App } from 'electron';

let installed = false;

type RawCapableStream = NodeJS.ReadStream & {
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => void;
};

function resetRawMode(stream: RawCapableStream | undefined): void {
  if (!stream) {
    return;
  }

  if (typeof stream.setRawMode === 'function' && stream.isRaw) {
    try {
      stream.setRawMode(false);
    } catch {
      // Ignore errors triggered when toggling raw mode during shutdown.
    }
  }

  if (typeof stream.pause === 'function') {
    stream.pause();
  }
}

export function installGracefulExit(
  targetApp: App = electronApp,
  targetProcess: NodeJS.Process = process
): void {
  if (installed) {
    return;
  }
  installed = true;

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  const stdin = targetProcess.stdin as RawCapableStream | undefined;
  let quitting = false;

  const tidyUp = () => {
    resetRawMode(stdin);
  };

  const requestQuit = () => {
    if (quitting) {
      return;
    }

    quitting = true;
    tidyUp();

    if (targetApp.isReady()) {
      targetApp.quit();
      return;
    }

    const quitWhenReady = () => {
      targetApp.quit();
    };

    targetApp.once('ready', quitWhenReady);
  };

  for (const signal of signals) {
    targetProcess.once(signal, () => {
      requestQuit();
    });
  }

  targetProcess.once('exit', tidyUp);
  targetApp.once('will-quit', tidyUp);
}
