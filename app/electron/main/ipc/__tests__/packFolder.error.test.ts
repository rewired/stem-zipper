import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { IPC_CHANNELS, type PackRequest, type PackStatusEvent } from '@common/ipc';
import { formatMessage } from '@common/i18n';

const packMock = vi.fn();
const handleMock = vi.fn();
const readdirMock = vi.fn();

const browserWindowMock = vi.fn(() => ({
  loadURL: vi.fn(async () => {}),
  on: vi.fn(),
  webContents: { openDevTools: vi.fn() }
}));
(browserWindowMock as unknown as { getAllWindows?: Mock }).getAllWindows = vi.fn(() => []);

const dialogMock = {
  showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  showMessageBox: vi.fn(async () => ({ response: 0 }))
};

const electronMock = {
  app: {
    whenReady: vi.fn(() => new Promise(() => {})),
    on: vi.fn(),
    getAppPath: vi.fn(() => '/tmp/app'),
    getPreferredSystemLanguages: vi.fn(() => []),
    getLocale: vi.fn(() => 'en'),
    quit: vi.fn()
  },
  BrowserWindow: browserWindowMock,
  ipcMain: {
    handle: handleMock
  },
  dialog: dialogMock,
  Menu: {
    setApplicationMenu: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(async () => '')
  }
};

vi.mock('electron', () => electronMock);

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    promises: {
      ...actual.promises,
      readdir: readdirMock
    }
  };
});

vi.mock('../../../gracefulExit', () => ({ installGracefulExit: vi.fn() }));

vi.mock('../../../services/pack', () => ({
  analyzeFolder: vi.fn(),
  createTestData: vi.fn(),
  pack: packMock
}));

describe('PACK_FOLDER handler error propagation', () => {
  beforeEach(() => {
    vi.resetModules();
    handleMock.mockReset();
    packMock.mockReset();
    readdirMock.mockReset();
    readdirMock.mockResolvedValue([]);
    dialogMock.showMessageBox.mockResolvedValue({ response: 0 });
  });

  async function setupHandler() {
    const { registerIpcHandlers } = await import('../../../main');
    registerIpcHandlers();
    const call = handleMock.mock.calls.find(([channel]) => channel === IPC_CHANNELS.PACK_FOLDER);
    expect(call).toBeDefined();
    const handler = call?.[1];
    expect(handler).toBeTypeOf('function');
    return handler as (
      event: { sender: { send: Mock } },
      args: PackRequest
    ) => Promise<void>;
  }

  function createRequest(): PackRequest {
    return {
      folderPath: '/tmp/folder',
      maxSizeMb: 100,
      locale: 'en',
      packMetadata: {
        title: 'Test',
        artist: 'Artist',
        license: { id: 'CC0-1.0' }
      },
      method: 'seven_z_split',
      files: []
    };
  }

  it('emits toast and error progress when pack fails and resets the guard afterwards', async () => {
    packMock.mockRejectedValueOnce(new Error('error_7z_spawn_failed'));
    packMock.mockResolvedValueOnce({ archives: ['/tmp/folder/stems.7z'] });
    const handler = await setupHandler();
    const send = vi.fn();
    const event = { sender: { send } };
    const request = createRequest();

    await handler(event, request);

    const toastCall = send.mock.calls.find(
      ([channel, payload]) =>
        channel === IPC_CHANNELS.PACK_STATUS && (payload as PackStatusEvent).type === 'toast'
    );
    expect(toastCall).toBeDefined();
    const toastEvent = toastCall?.[1] as PackStatusEvent;
    expect(toastEvent.type).toBe('toast');
    expect(toastEvent.toast.level).toBe('warning');
    expect(toastEvent.toast.titleKey).toBe('toast_warning_title');
    expect(toastEvent.toast.messageKey).toBe('pack_error_generic');

    const friendly = formatMessage('en', 'error_7z_spawn_failed');
    expect(toastEvent.toast.params).toEqual({ message: friendly });

    const progressStatusCall = send.mock.calls.find(
      ([channel, payload]) =>
        channel === IPC_CHANNELS.PACK_STATUS && (payload as PackStatusEvent).type === 'progress'
    );
    expect(progressStatusCall).toBeDefined();
    const progressStatus = progressStatusCall?.[1] as PackStatusEvent;
    expect(progressStatus.type).toBe('progress');
    expect(progressStatus.progress.state).toBe('error');
    expect(progressStatus.progress.percent).toBe(0);
    expect(progressStatus.progress.message).toBe('pack_progress_error');
    expect(progressStatus.progress.errorMessage).toBe(friendly);

    const directProgressCall = send.mock.calls.find(
      ([channel]) => channel === IPC_CHANNELS.PACK_PROGRESS
    );
    expect(directProgressCall).toBeDefined();
    expect((directProgressCall?.[1] as { state: string }).state).toBe('error');

    const errorCall = send.mock.calls.find(([channel]) => channel === IPC_CHANNELS.PACK_ERROR);
    expect(errorCall).toBeDefined();
    const errorPayload = errorCall?.[1] as { message: string; code: string };
    expect(errorPayload.code).toBe('error_7z_spawn_failed');
    expect(errorPayload.message).toBe(formatMessage('en', 'pack_error_generic', { message: friendly }));

    const nextSend = vi.fn();
    await handler({ sender: { send: nextSend } }, request);
    expect(packMock).toHaveBeenCalledTimes(2);
  });
});
