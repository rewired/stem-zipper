import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../providers/ToastProvider';
import { AppStoreProvider } from '../store/appStore';
import { MetadataProvider } from '../features/metadata/useMetadata';
import { PackStateProvider } from '../features/pack/usePackState';
import { AppShell } from '../routes/AppShell';
import type { FileEntry, PackErrorPayload, PackProgress, PackResult, PackStatusEvent } from '@common/ipc';
import type { RuntimeConfig } from '@common/runtime';
import { PlayerProvider } from '../features/player';

const MB = 1024 * 1024;

const mockFile: FileEntry = {
  name: 'beat.wav',
  sizeMb: 10,
  action: 'normal',
  path: '/tmp/beat.wav',
  sizeBytes: 10 * MB,
  kind: 'wav'
};

type ProgressListener = (event: PackProgress) => void;
type StatusListener = (event: PackStatusEvent) => void;
type ResultListener = (event: PackResult) => void;
type ErrorListener = (event: PackErrorPayload) => void;

const nextTick = (delay = 20) => new Promise<void>((resolve) => setTimeout(resolve, delay));

function createProgressBus() {
  const listeners = new Set<ProgressListener>();
  return {
    register(listener: ProgressListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: PackProgress) {
      listeners.forEach((listener) => listener(event));
    }
  };
}

function createStatusBus() {
  const listeners = new Set<StatusListener>();
  return {
    register(listener: StatusListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: PackStatusEvent) {
      listeners.forEach((listener) => listener(event));
    }
  };
}
function createResultBus() {
  const listeners = new Set<ResultListener>();
  return {
    register(listener: ResultListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: PackResult) {
      listeners.forEach((listener) => listener(event));
    }
  };
}

function createErrorBus() {
  const listeners = new Set<ErrorListener>();
  return {
    register(listener: ErrorListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(event: PackErrorPayload) {
      listeners.forEach((listener) => listener(event));
    }
  };
}


function createElectronMock() {
  const progressBus = createProgressBus();
  const statusBus = createStatusBus();
  const resultBus = createResultBus();
  const errorBus = createErrorBus();

  const api = {
    selectFolder: vi.fn().mockResolvedValue('/tmp/session'),
    analyzeFolder: vi.fn().mockResolvedValue({ files: [mockFile], count: 1, maxSizeMb: 100 }),
    estimateZipCount: vi.fn().mockResolvedValue({
      zips: 7,
      bytesLogical: 8 * MB,
      bytesCapacity: 12 * MB,
      packing: { maxZipSize: 0, capacityBytes: 0, perZipOverheadBytes: 0, files: [] }
    }),
    estimatePackingPlan: vi
      .fn()
      .mockResolvedValue({
        plan: [
          {
            path: mockFile.path,
            archiveIndex: 1,
            archiveLabel: 'stems-01.zip',
            allowed: true
          }
        ]
      }),
    startPack: vi.fn().mockImplementation(async () => {
      api.emitProgress({
        state: 'preparing',
        current: 0,
        total: 2,
        percent: 0,
        message: 'pack_progress_preparing'
      });
      await nextTick();
      api.emitProgress({
        state: 'packing',
        current: 1,
        total: 2,
        percent: 50,
        message: 'pack_progress_packing',
        currentArchive: 'session-1.zip'
      });
      await nextTick();
      api.emitProgress({
        state: 'done',
        current: 2,
        total: 2,
        percent: 100,
        message: 'pack_progress_done'
      });
      api.emitDone({ archives: ['/tmp/session/stems-01.zip'], method: 'zip_best_fit' });
    }),
    checkExistingZips: vi.fn().mockResolvedValue({ count: 0, files: [] }),
    onPackProgress: vi.fn((listener: ProgressListener) => progressBus.register(listener)),
    emitProgress: progressBus.emit,
    onPackStatus: vi.fn((listener: StatusListener) => statusBus.register(listener)),
    emitStatus: statusBus.emit,
    onPackDone: vi.fn((listener: ResultListener) => resultBus.register(listener)),
    emitDone: resultBus.emit,
    onPackError: vi.fn((listener: ErrorListener) => errorBus.register(listener)),
    emitError: errorBus.emit,
    getUserPrefs: vi.fn().mockResolvedValue({
      default_artist: 'Default Artist',
      default_artist_url: 'https://example.com',
      default_contact_email: 'artist@example.com',
      recent_artists: ['Default Artist']
    }),
    setUserPrefs: vi.fn().mockResolvedValue(undefined),
    addRecentArtist: vi.fn().mockResolvedValue(undefined),
    createTestData: vi.fn().mockResolvedValue({ count: 3, folderPath: '/tmp/session' }),
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(undefined)
  } as const;

  return api;
}

describe('AppShell integration', () => {
  function renderApp() {
    return render(
      <ToastProvider>
        <AppStoreProvider>
          <MetadataProvider>
            <PackStateProvider>
              <PlayerProvider>
                <AppShell />
              </PlayerProvider>
            </PackStateProvider>
          </MetadataProvider>
        </AppStoreProvider>
      </ToastProvider>
    );
  }

  beforeEach(() => {
    window.electronAPI = createElectronMock() as typeof window.electronAPI;
    window.runtimeConfig = { locale: 'en', devMode: false } as RuntimeConfig;
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['en-US']
    });
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the root route shell', async () => {
    renderApp();
    const labels = await screen.findAllByText(/Stem ZIPper/i);
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Select folder/i })).toBeTruthy();
  });

  it('shows an estimate toast after selecting a folder', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: /Select folder/i }));

    await screen.findByText('Estimating packs…');
    await waitFor(() => {
      expect(screen.getByText(/Estimated: 7 pack/)).toBeTruthy();
    });
    expect(window.electronAPI?.estimateZipCount).toHaveBeenCalled();
  });

  it('dismisses the estimate toast and updates progress when packing starts', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: /Select folder/i }));
    await screen.findByText('Estimating packs…');

    const modal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    await userEvent.type(within(modal).getByLabelText(/Title/i), 'Test Pack');
    const artistInput = within(modal).getByDisplayValue('Default Artist') as HTMLInputElement;
    if (!artistInput.value) {
      await userEvent.type(artistInput, 'Default Artist');
    }
    await userEvent.selectOptions(within(modal).getByLabelText(/License/i), ['CC0-1.0']);
    await userEvent.click(within(modal).getByRole('button', { name: /Save/i }));

    await userEvent.click(screen.getByRole('button', { name: /Pack Now/i }));

    await waitFor(() => {
      expect(screen.queryByText('Estimating packs…')).toBeNull();
    });
    await screen.findByText('Packing session-1.zip (50%)');
    expect(window.electronAPI?.startPack).toHaveBeenCalledWith(
      expect.objectContaining({ method: expect.any(String) })
    );
  });

  it('persists the selected pack method', async () => {
    localStorage.setItem('stem-zipper.pack-method', 'seven_z_split');
    renderApp();
    const select = await screen.findByLabelText(/Pack method/i);
    expect((select as HTMLSelectElement).value).toBe('seven_z_split');

    await userEvent.selectOptions(select, 'zip_best_fit');
    expect(localStorage.getItem('stem-zipper.pack-method')).toBe('zip_best_fit');
  });
});
