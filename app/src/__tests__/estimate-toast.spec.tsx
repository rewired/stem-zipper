import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { ToastProvider } from '../components/ui/ToastProvider';
import type { PackProgress, PackStatusEvent } from '@common/ipc';
import type { LocaleKey } from '@common/i18n';

const mockFileEntry = {
  name: 'alpha.wav',
  sizeMb: 4,
  action: 'normal' as const,
  path: '/tmp/alpha.wav',
  sizeBytes: 1_000,
  kind: 'wav' as const
};

function createElectronAPIMock() {
  const progressListeners = new Set<(event: PackProgress) => void>();
  const statusListeners = new Set<(event: PackStatusEvent) => void>();

  return {
    selectFolder: vi.fn().mockResolvedValue('/tmp/project'),
    analyzeFolder: vi.fn().mockResolvedValue({ files: [mockFileEntry], count: 1, maxSizeMb: 100 }),
    estimateZipCount: vi.fn().mockResolvedValue({ zips: 7 }),
    startPack: vi.fn().mockResolvedValue(1),
    onPackProgress: vi.fn((listener: (event: PackProgress) => void) => {
      progressListeners.add(listener);
      return () => {
        progressListeners.delete(listener);
      };
    }),
    emitProgress: (event: PackProgress) => {
      progressListeners.forEach((listener) => listener(event));
    },
    onPackStatus: vi.fn((listener: (event: PackStatusEvent) => void) => {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    }),
    emitStatus: (event: PackStatusEvent) => {
      statusListeners.forEach((listener) => listener(event));
    },
    checkExistingZips: vi.fn().mockResolvedValue({ count: 0, files: [] }),
    getUserPrefs: vi.fn().mockResolvedValue({
      default_artist: 'Saved Artist',
      default_artist_url: 'https://saved.example',
      default_contact_email: 'saved@example.com',
      recent_artists: ['Saved Artist']
    }),
    setUserPrefs: vi.fn().mockResolvedValue(undefined),
    addRecentArtist: vi.fn().mockResolvedValue(undefined),
    createTestData: vi.fn(),
    openExternal: vi.fn(),
    openPath: vi.fn()
  };
}

type ElectronAPIMock = ReturnType<typeof createElectronAPIMock>;

let electronAPI: ElectronAPIMock;

function TestHarness({ locale }: { locale: LocaleKey }) {
  window.runtimeConfig = { locale, devMode: false };
  return <App key={locale} />;
}

async function advanceEstimateTimers() {
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
  await Promise.resolve();
}

describe('estimate toast lifecycle', () => {
  beforeEach(() => {
    electronAPI = createElectronAPIMock();
    window.electronAPI = electronAPI as unknown as Window['electronAPI'];
    window.runtimeConfig = { locale: 'en', devMode: false };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows estimate after analyze with files', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <TestHarness locale="en" />
      </ToastProvider>
    );

    const selectFolderButton = screen.getByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(1);
    });

    await advanceEstimateTimers();

    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);
  });

  it('does not re-show estimate after pack flow triggers re-analyze', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    electronAPI.startPack.mockImplementation(async () => {
      electronAPI.emitProgress({
        state: 'packing',
        current: 0,
        total: 1,
        percent: 0,
        message: 'packing'
      });
      electronAPI.emitProgress({
        state: 'finished',
        current: 1,
        total: 1,
        percent: 100,
        message: 'done'
      });
      return 1;
    });

    render(
      <ToastProvider>
        <TestHarness locale="en" />
      </ToastProvider>
    );

    const selectFolderButton = screen.getByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(1);
    });

    await advanceEstimateTimers();

    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);

    const initialEstimateCalls = electronAPI.estimateZipCount.mock.calls.length;

    const initialModal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const closeButton = within(initialModal).getByRole('button', { name: /^Close$/i });
    await user.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Pack metadata/i })).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: /Pack Now/i }));

    const metadataModal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const titleInput = within(metadataModal).getByLabelText((content: string) => content.startsWith('Title')) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Pack Title');
    const licenseSelect = within(metadataModal).getByLabelText((content: string) => content.startsWith('License'));
    await user.selectOptions(licenseSelect, 'CC-BY-4.0');
    const saveAndPack = within(metadataModal).getByRole('button', { name: /Save & Pack/i });
    await user.click(saveAndPack);

    await waitFor(() => {
      expect(electronAPI.startPack).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByText(/This run will likely produce/)).toBeNull();
    });

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(2);
    });

    await advanceEstimateTimers();

    expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(initialEstimateCalls);
    expect(screen.queryByText(/Calculating ZIP estimate/i)).toBeNull();
    expect(screen.queryByText(/This run will likely produce/)).toBeNull();
  });

  it('replaces the estimate toast instead of stacking on locale changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const { rerender } = render(
      <ToastProvider>
        <TestHarness locale="en" />
      </ToastProvider>
    );

    const selectFolderButton = screen.getByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(1);
    });

    await advanceEstimateTimers();

    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);

    rerender(
      <ToastProvider>
        <TestHarness locale="de" />
      </ToastProvider>
    );

    const germanSelectFolder = screen.getByRole('button', { name: /Ordner auswählen/i });
    await user.click(germanSelectFolder);

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(2);
    });

    await advanceEstimateTimers();

    await screen.findByText(/≈ 7 ZIP-Archiv/i);
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});
