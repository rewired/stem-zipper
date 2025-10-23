import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { ToastProvider } from '../components/ui/ToastProvider';
import type { PackMetadata } from '@common/ipc';

const mockFileEntry = {
  name: 'alpha.wav',
  sizeMb: 4,
  action: 'normal',
  path: '/tmp/alpha.wav',
  sizeBytes: 1_000,
  kind: 'wav' as const
};

function createElectronAPIMock() {
  const analyzeFolder = vi.fn().mockResolvedValue({ files: [mockFileEntry], count: 1, maxSizeMb: 100 });
  const startPack = vi.fn().mockResolvedValue(1);
  return {
    selectFolder: vi.fn().mockResolvedValue('/tmp/project'),
    analyzeFolder,
    startPack,
    onPackProgress: vi.fn().mockReturnValue(() => {}),
    createTestData: vi.fn(),
    openExternal: vi.fn(),
    openPath: vi.fn(),
    checkExistingZips: vi.fn().mockResolvedValue({ count: 0, files: [] }),
    estimateZipCount: vi.fn().mockResolvedValue({ zips: 1 }),
    getUserPrefs: vi.fn().mockResolvedValue({ default_artist: 'Saved Artist', recent_artists: ['Saved Artist'] }),
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
    const artistInput = await screen.findByLabelText((content) => content.startsWith('Artist') && !content.includes('URL'));
    expect((artistInput as HTMLInputElement).value).toBe('Saved Artist');
  });

  it('saves metadata and triggers packing when using Save & Pack', async () => {
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
    const titleInput = within(modal).getByLabelText((content) => content.startsWith('Title')) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Title');
    const licenseSelect = within(modal).getByLabelText((content) => content.startsWith('License'));
    await user.selectOptions(licenseSelect, 'CC-BY-4.0');
    const saveAndPack = within(modal).getByRole('button', { name: /Save & Pack/i });
    await user.click(saveAndPack);

    await waitFor(() => {
      expect(electronAPI.startPack).toHaveBeenCalled();
    });
    const request = electronAPI.startPack.mock.calls[0][0] as { packMetadata: PackMetadata };
    expect(request.packMetadata).toMatchObject({
      title: 'Test Title',
      artist: 'Saved Artist',
      license: { id: 'CC-BY-4.0' }
    });
  });
});
