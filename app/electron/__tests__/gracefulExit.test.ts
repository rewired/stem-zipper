import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'electron';
import type { Mock } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isReady: vi.fn(() => true),
    quit: vi.fn(),
    once: vi.fn()
  }
}));

function createProcessMock() {
  const listeners = new Map<string | symbol, () => void>();
  const stdin = {
    isTTY: true,
    isRaw: true,
    setRawMode: vi.fn(),
    pause: vi.fn()
  };

  const processMock = {
    stdin: stdin as unknown as NodeJS.ReadStream,
    once: vi.fn((event: string | symbol, handler: () => void) => {
      listeners.set(event, handler);
      return processMock;
    })
  } as unknown as NodeJS.Process;

  return { processMock, listeners, stdin };
}

function createAppMock({ ready }: { ready: boolean }) {
  const listeners = new Map<string | symbol, () => void>();
  let isReady = ready;

  const appMock = {
    isReady: vi.fn(() => isReady),
    quit: vi.fn(),
    once: vi.fn((event: string | symbol, handler: () => void) => {
      listeners.set(event, handler);
      return appMock;
    })
  } as unknown as App;

  const setReady = (nextReady: boolean) => {
    isReady = nextReady;
  };

  return { appMock, listeners, setReady };
}

describe('installGracefulExit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers signal listeners only once', async () => {
    const { installGracefulExit } = await import('../gracefulExit');
    const { processMock, listeners } = createProcessMock();
    const { appMock } = createAppMock({ ready: true });

    installGracefulExit(appMock, processMock);
    installGracefulExit(appMock, processMock);

    const onceMock = processMock.once as unknown as Mock;
    expect(onceMock.mock.calls.length).toBe(3);
    expect(listeners.size).toBe(3);
  });

  it('quits the app and resets raw mode on SIGINT', async () => {
    const { installGracefulExit } = await import('../gracefulExit');
    const { processMock, listeners, stdin } = createProcessMock();
    const { appMock } = createAppMock({ ready: true });

    installGracefulExit(appMock, processMock);

    const sigintHandler = listeners.get('SIGINT');
    expect(sigintHandler).toBeDefined();
    sigintHandler?.();

    expect(appMock.quit).toHaveBeenCalledTimes(1);
    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
    expect(stdin.pause).toHaveBeenCalledTimes(1);
  });

  it('waits for the app to become ready before quitting', async () => {
    const { installGracefulExit } = await import('../gracefulExit');
    const { processMock, listeners } = createProcessMock();
    const { appMock, listeners: appListeners, setReady } = createAppMock({ ready: false });

    installGracefulExit(appMock, processMock);

    listeners.get('SIGTERM')?.();

    expect(appMock.quit).not.toHaveBeenCalled();

    setReady(true);
    appListeners.get('ready')?.();

    expect(appMock.quit).toHaveBeenCalledTimes(1);
  });
});
