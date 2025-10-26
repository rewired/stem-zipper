import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { ToastProvider } from '../components/ui/ToastProvider';
import type { PackMetadata, PackProgress } from '@common/ipc';

const mockFileEntry = {
  name: 'alpha.wav',
  sizeMb: 4,
  action: 'normal',
  path: '/tmp/alpha.wav',
  sizeBytes: 1_000,
  kind: 'wav' as const
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createElectronAPIMock() {
  const analyzeFolder = vi.fn().mockResolvedValue({ files: [mockFileEntry], count: 1, maxSizeMb: 100 });
  const startPack = vi.fn().mockResolvedValue(1);
  const progressListeners = new Set<(event: PackProgress) => void>();
  return {
    selectFolder: vi.fn().mockResolvedValue('/tmp/project'),
    analyzeFolder,
    startPack,
    onPackProgress: vi.fn((listener: (event: PackProgress) => void) => {
      progressListeners.add(listener);
      return () => {
        progressListeners.delete(listener);
      };
    }),
    emitProgress: (event: PackProgress) => {
      progressListeners.forEach((listener) => listener(event));
    },
    createTestData: vi.fn(),
    openExternal: vi.fn(),
    openPath: vi.fn(),
    checkExistingZips: vi.fn().mockResolvedValue({ count: 0, files: [] }),
    estimateZipCount: vi.fn().mockResolvedValue({ zips: 1 }),
    getUserPrefs: vi.fn().mockResolvedValue({
      default_artist: 'Saved Artist',
      default_artist_url: 'https://saved.example',
      default_contact_email: 'saved@example.com',
      recent_artists: ['Saved Artist']
    }),
    setUserPrefs: vi.fn().mockResolvedValue(undefined),
    addRecentArtist: vi.fn().mockResolvedValue(undefined)
  };
}

let electronAPI: ReturnType<typeof createElectronAPIMock>;

beforeEach(() => {
  window.runtimeConfig = { locale: 'en', devMode: false };
  electronAPI = createElectronAPIMock();
  window.electronAPI = electronAPI as unknown as Window['electronAPI'];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('metadata modal integration', () => {
  it('opens when the metadata button is clicked', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);
    expect(electronAPI.selectFolder).toHaveBeenCalled();

    await screen.findByRole('button', { name: /Metadata/i });
    await user.click(screen.getByRole('button', { name: /Metadata/i }));

    await screen.findByRole('heading', { name: /Pack metadata/i });
  });

  it('auto-opens after analyzing a folder when required metadata is missing', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await screen.findByRole('heading', { name: /Pack metadata/i });
  });

  it('prefills the artist from stored preferences', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);
    await screen.findByRole('heading', { name: /Pack metadata/i });
    const artistInput = await screen.findByLabelText(
      (content: string) => content.startsWith('Artist') && !content.includes('URL')
    );
    expect((artistInput as HTMLInputElement).value).toBe('Saved Artist');
    const artistUrlInput = await screen.findByLabelText((content: string) => content.startsWith('Artist URL'));
    expect((artistUrlInput as HTMLInputElement).value).toBe('https://saved.example');
    const emailInput = await screen.findByLabelText((content: string) => content.startsWith('Email'));
    expect((emailInput as HTMLInputElement).value).toBe('saved@example.com');
  });

  it('saves metadata and triggers packing when using Save & Pack', async () => {
    electronAPI.getUserPrefs.mockResolvedValueOnce({
      default_artist: 'Saved Artist',
      recent_artists: ['Saved Artist']
    });
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);
    const initialModal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const initialClose = within(initialModal).getByRole('button', { name: /^Close$/i });
    await user.click(initialClose);
    await user.click(screen.getByRole('button', { name: /Pack Now/i }));
    const modal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const titleInput = within(modal).getByLabelText((content: string) => content.startsWith('Title')) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Title');
    const licenseSelect = within(modal).getByLabelText((content: string) => content.startsWith('License'));
    await user.selectOptions(licenseSelect, 'CC-BY-4.0');
    const artistUrlInput = within(modal).getByLabelText(
      (content: string) => content.startsWith('Artist URL')
    ) as HTMLInputElement;
    await user.click(artistUrlInput);
    await user.type(artistUrlInput, 'https://artist.example');
    expect(artistUrlInput.value).toBe('https://artist.example');
    const emailInput = within(modal).getByLabelText((content: string) => content.startsWith('Email')) as HTMLInputElement;
    await user.click(emailInput);
    await user.type(emailInput, 'contact@example.com');
    expect(emailInput.value).toBe('contact@example.com');
    const saveAndPack = within(modal).getByRole('button', { name: /Save & Pack/i });
    await user.click(saveAndPack);

    await waitFor(() => {
      expect(electronAPI.startPack).toHaveBeenCalled();
    });
    const request = electronAPI.startPack.mock.calls[0][0] as { packMetadata: PackMetadata };
    expect(request.packMetadata).toMatchObject({
      title: 'Test Title',
      artist: 'Saved Artist',
      license: { id: 'CC-BY-4.0' },
      links: { artist_url: 'https://artist.example', contact_email: 'contact@example.com' }
    });
    expect(electronAPI.setUserPrefs).toHaveBeenCalledWith({
      default_artist: 'Saved Artist',
      default_artist_url: 'https://artist.example',
      default_contact_email: 'contact@example.com'
    });
  });

  it('does not request a new estimate immediately after packing', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);
    const initialModal = await screen.findByRole('dialog', { name: /Pack metadata/i });

    await waitFor(() => {
      expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(1);
    });
    const initialEstimateCalls = electronAPI.estimateZipCount.mock.calls.length;

    const initialClose = within(initialModal).getByRole('button', { name: /^Close$/i });
    await user.click(initialClose);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Pack metadata/i })).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: /Pack Now/i }));
    const modal = await screen.findByRole('dialog', { name: /Pack metadata/i });
    const titleInput = within(modal).getByLabelText(
      (content: string) => content.startsWith('Title')
    ) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Pack Title');
    const licenseSelect = within(modal).getByLabelText((content: string) => content.startsWith('License'));
    await user.selectOptions(licenseSelect, 'CC-BY-4.0');
    const saveAndPack = within(modal).getByRole('button', { name: /Save & Pack/i });
    await user.click(saveAndPack);

    await waitFor(() => {
      expect(electronAPI.startPack).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(electronAPI.analyzeFolder).toHaveBeenCalledTimes(2);
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(initialEstimateCalls);
  });

  it('dismisses the estimate toast once packing finishes', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await screen.findByText(/This run will likely produce/);

    electronAPI.emitProgress({
      state: 'finished',
      current: 0,
      total: 1,
      percent: 100,
      message: 'done'
    });

    await waitFor(() => {
      expect(screen.queryByText(/This run will likely produce/)).toBeNull();
    });
  });

  it('ignores stale estimate responses when inputs change quickly', async () => {
    const firstEstimate = createDeferred<{ zips: number }>();
    const secondEstimate = createDeferred<{ zips: number }>();
    electronAPI.estimateZipCount
      .mockReturnValueOnce(firstEstimate.promise)
      .mockReturnValueOnce(secondEstimate.promise);

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await waitFor(() => {
      expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(1);
    });

    const maxSizeInput = await screen.findByLabelText(/Max ZIP size/i);
    await user.clear(maxSizeInput);
    await user.type(maxSizeInput, '50');

    await waitFor(() => {
      expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(2);
    });

    secondEstimate.resolve({ zips: 5 });
    await Promise.resolve();
    firstEstimate.resolve({ zips: 3 });
    await Promise.resolve();

    await waitFor(() => {
      expect(screen.getByText(/≈ 5 ZIP/i)).toBeTruthy();
    });
    expect(screen.queryByText(/≈ 3 ZIP/i)).toBeNull();
  });

  it('requests a fresh estimate after packing when the max size changes', async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    const user = userEvent.setup();

    const selectFolderButton = await screen.findByRole('button', { name: /Select Folder/i });
    await user.click(selectFolderButton);

    await waitFor(() => {
      expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(1);
    });

    const maxSizeInput = await screen.findByLabelText(/Max ZIP size/i);

    const initialEstimateCalls = electronAPI.estimateZipCount.mock.calls.length;

    electronAPI.emitProgress({
      state: 'finished',
      current: 0,
      total: 1,
      percent: 100,
      message: 'done'
    });

    await waitFor(() => {
      expect(screen.queryByText(/This run will likely produce/)).toBeNull();
    });

    await user.clear(maxSizeInput);
    await user.type(maxSizeInput, '120');
    await user.tab();

    await waitFor(() => {
      expect(electronAPI.estimateZipCount).toHaveBeenCalledTimes(initialEstimateCalls + 1);
    });
  });
});
