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

function createElectronAPIMock() {
  const progressBus = createProgressBus();
  const statusBus = createStatusBus();

  return {
    selectFolder: vi.fn().mockResolvedValue('/tmp/project'),
    analyzeFolder: vi.fn().mockResolvedValue({ files: [mockFileEntry], count: 1, maxSizeMb: 100 }),
    estimateZipCount: vi.fn().mockResolvedValue({ zips: 7 }),
    startPack: vi.fn().mockResolvedValue(1),
    onPackProgress: vi.fn((listener: ProgressListener) => progressBus.register(listener)),
    emitProgress: progressBus.emit,
    onPackStatus: vi.fn((listener: StatusListener) => statusBus.register(listener)),
    emitStatus: statusBus.emit,
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
type TestUser = ReturnType<typeof userEvent.setup>;

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

function getSelectFolderLabel(locale: LocaleKey) {
  return locale === 'de' ? /Ordner auswählen/i : /Select Folder/i;
}

function getPackButtonLabel(locale: LocaleKey) {
  return locale === 'de' ? /Jetzt packen/i : /Pack Now/i;
}

function getEstimateToast() {
  const toast = document.querySelector('[data-toast-id="estimate"]');
  if (!toast) {
    throw new Error('Expected estimate toast to be present');
  }
  return toast as HTMLElement;
}

function queryEstimateToast() {
  return document.querySelector('[data-toast-id="estimate"]') as HTMLElement | null;
}

function countEstimateToasts() {
  return document.querySelectorAll('[data-toast-id="estimate"]').length;
}

describe('estimate toast lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    electronAPI = createElectronAPIMock();
    window.electronAPI = electronAPI as unknown as Window['electronAPI'];
    window.runtimeConfig = { locale: 'en', devMode: false };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  async function renderApp(locale: LocaleKey = 'en') {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const utils = render(
      <ToastProvider>
        <TestHarness locale={locale} />
      </ToastProvider>
    );
    return { user, locale, ...utils };
  }

  async function seedFiles(user: TestUser, locale: LocaleKey = 'en') {
    const previousCalls = electronAPI.analyzeFolder.mock.calls.length;
    const selectFolderButton = screen.getByRole('button', { name: getSelectFolderLabel(locale) });
    await user.click(selectFolderButton);
    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(previousCalls + 1);
    });
    await advanceEstimateTimers();
  }

  async function completeMetadataAndPack(user: TestUser, locale: LocaleKey = 'en') {
    const packButton = screen.getByRole('button', { name: getPackButtonLabel(locale) });
    await user.click(packButton);

    const modal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const titleInput = within(modal).getByLabelText((content: string) => content.startsWith('Title')) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Pack Title');
    const [artistInput] = within(modal).getAllByLabelText(/Artist/i) as HTMLInputElement[];
    await user.clear(artistInput);
    await user.type(artistInput, 'Artist Name');
    const licenseSelect = within(modal).getByLabelText((content: string) => content.startsWith('License'));
    await user.selectOptions(licenseSelect, 'CC-BY-4.0');
    const saveAndPack = within(modal).getByRole('button', { name: /Save & Pack/i });
    await user.click(saveAndPack);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Pack metadata/i })).toBeNull();
    });
  }

  it('shows estimate after analyze with files', async () => {
    const { user, locale } = await renderApp('en');

    await seedFiles(user, locale);

    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);
    expect(getEstimateToast()).toBeInstanceOf(HTMLElement);
  });

  it('does not re-show estimate after pack flow triggers re-analyze', async () => {
    const { user, locale } = await renderApp('en');

    await seedFiles(user, locale);
    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);

    const initialEstimateCalls = electronAPI.estimateZipCount.mock.calls.length;

    const packDeferred = (() => {
      let resolve!: (value: number) => void;
      const promise = new Promise<number>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    })();

    electronAPI.startPack.mockImplementation(async () => packDeferred.promise);

    await completeMetadataAndPack(user, locale);

    await waitFor(() => {
      expect(electronAPI.startPack).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      electronAPI.emitProgress({
        state: 'packing',
        current: 0,
        total: 1,
        percent: 0,
        message: 'packing'
      });
    });

    await waitFor(() => {
      expect(queryEstimateToast()).toBeNull();
    });

    await act(async () => {
      packDeferred.resolve(1);
    });

    await act(async () => {
      electronAPI.emitProgress({
        state: 'finished',
        current: 1,
        total: 1,
        percent: 100,
        message: 'done'
      });
    });

    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(2);
    });

    await advanceEstimateTimers();

    expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(initialEstimateCalls);
    expect(queryEstimateToast()).toBeNull();
  });

  it('replaces the estimate toast instead of stacking on locale changes', async () => {
    const { user, locale, rerender } = await renderApp('en');

    await seedFiles(user, locale);

    await screen.findByText(/This run will likely produce ≈ 7 ZIP archive\(s\)\./i);
    expect(countEstimateToasts()).toBe(1);

    rerender(
      <ToastProvider>
        <TestHarness locale="de" />
      </ToastProvider>
    );

    await seedFiles(user, 'de');

    await screen.findByText(/≈ 7 ZIP-Archiv/i);
    expect(countEstimateToasts()).toBe(1);
  });
});
