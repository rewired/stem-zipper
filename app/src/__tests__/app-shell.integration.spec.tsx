import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../providers/ToastProvider';
import { AppStoreProvider } from '../store/appStore';
import { MetadataProvider } from '../features/metadata/useMetadata';
import { PackStateProvider } from '../features/pack/usePackState';
import { AppShell } from '../routes/AppShell';
import type { FileEntry, PackProgress, PackStatusEvent } from '@common/ipc';
import type { RuntimeConfig } from '@common/runtime';

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

function createElectronMock() {
  const progressBus = createProgressBus();
  const statusBus = createStatusBus();

  const api = {
    selectFolder: vi.fn().mockResolvedValue('/tmp/session'),
    analyzeFolder: vi.fn().mockResolvedValue({ files: [mockFile], count: 1, maxSizeMb: 100 }),
    estimateZipCount: vi.fn().mockResolvedValue({
      zips: 7,
      bytesLogical: 8 * MB,
      bytesCapacity: 12 * MB,
      packing: { maxZipSize: 0, capacityBytes: 0, perZipOverheadBytes: 0, files: [] }
    }),
    startPack: vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      api.emitProgress({
        state: 'packing',
        current: 1,
        total: 2,
        percent: 50,
        message: 'pack_status_in_progress',
        currentZip: 'session-1.zip'
      });
      return 1;
    }),
    checkExistingZips: vi.fn().mockResolvedValue({ count: 0, files: [] }),
    onPackProgress: vi.fn((listener: ProgressListener) => progressBus.register(listener)),
    emitProgress: progressBus.emit,
    onPackStatus: vi.fn((listener: StatusListener) => statusBus.register(listener)),
    emitStatus: statusBus.emit,
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
              <AppShell />
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
    await screen.findByText('50%');
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
