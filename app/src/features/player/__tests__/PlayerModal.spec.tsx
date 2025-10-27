import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PlayerModal } from '../PlayerModal';
import { PlayerProvider, usePlayer } from '../PlayerProvider';
import type { FileRow } from '../../../types/fileRow';
import { ToastProvider } from '../../../providers/ToastProvider';
import { AppStoreProvider } from '../../../store/appStore';
import { createWaveSurfer } from '../waveSurfer';

vi.mock('../waveSurfer', () => {
  class FakeWaveSurfer {
    duration = 10;
    private currentTime = 0;
    private playing = false;
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    on(event: string, handler: (...args: unknown[]) => void) {
      const existing = this.listeners.get(event) ?? new Set();
      existing.add(handler);
      this.listeners.set(event, existing);
    }

    un(event: string, handler: (...args: unknown[]) => void) {
      const existing = this.listeners.get(event);
      if (!existing) {
        return;
      }
      existing.delete(handler);
    }

    emit(event: string, ...args: unknown[]) {
      const existing = this.listeners.get(event);
      if (!existing) {
        return;
      }
      for (const listener of existing) {
        listener(...args);
      }
    }

    load = vi.fn();

    loadBlob = vi.fn(() => Promise.resolve());

    destroy = vi.fn(() => {
      this.listeners.clear();
    });

    getDuration() {
      return this.duration;
    }

    getCurrentTime() {
      return this.currentTime;
    }

    isPlaying() {
      return this.playing;
    }

    play = vi.fn(() => {
      this.playing = true;
      this.emit('play');
      return Promise.resolve();
    });

    pause = vi.fn(() => {
      this.playing = false;
      this.emit('pause');
    });

    playPause = vi.fn(() => {
      if (this.playing) {
        this.pause();
        return;
      }
      void this.play();
    });

    seekTo = vi.fn((progress: number) => {
      this.currentTime = this.duration * progress;
      this.emit('seek', progress);
    });

    setVolume = vi.fn();
  }

  const instances: FakeWaveSurfer[] = [];
  const factory = vi.fn(() => {
    const instance = new FakeWaveSurfer();
    instances.push(instance);
    return instance;
  });

  const reset = () => {
    instances.splice(0, instances.length);
  };

  const augmentedFactory = Object.assign(factory, {
    __getWaveSurferInstances: () => instances,
    __resetWaveSurferMocks: reset
  });

  return {
    __esModule: true,
    createWaveSurfer: augmentedFactory
  };
});

const waveSurferModule = createWaveSurfer as unknown as {
  __getWaveSurferInstances: () => Array<{
    destroy: ReturnType<typeof vi.fn>;
    playPause: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => void;
  }>;
  __resetWaveSurferMocks: () => void;
};

const sampleFile: FileRow = {
  id: 'file-1',
  name: 'clip.wav',
  path: '/tmp/clip.wav',
  sizeMb: 1,
  sizeBytes: 1024,
  action: 'normal',
  kind: 'wav',
  selectable: true,
  selected: true
};

function AutoOpenPlayer({ file }: { file: FileRow }) {
  const player = usePlayer();
  useEffect(() => {
    player.open(file);
  }, [file, player]);
  return <PlayerModal />;
}

function renderModal(file: FileRow) {
  return render(
    <AppStoreProvider>
      <ToastProvider>
        <PlayerProvider>
          <AutoOpenPlayer file={file} />
        </PlayerProvider>
      </ToastProvider>
    </AppStoreProvider>
  );
}

describe('PlayerModal', () => {
  const originalApi = window.api;
  const originalCreateObjectUrl = window.URL.createObjectURL;
  const originalRevokeObjectUrl = window.URL.revokeObjectURL;
  const originalBlob = window.Blob;
  let blobSpy: ReturnType<typeof vi.fn<[BlobPart[], BlobPropertyBag | undefined], void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    waveSurferModule.__resetWaveSurferMocks();
    Object.defineProperty(window, 'api', {
      value: {
        readFileBlob: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
        teardownAudio: vi.fn()
      },
      configurable: true,
      writable: true
    });
    window.URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = vi.fn() as unknown as typeof window.URL.revokeObjectURL;
    blobSpy = vi.fn<[BlobPart[], BlobPropertyBag | undefined], void>();
    class SpyBlob extends originalBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts ?? [], options);
        blobSpy(blobParts ?? [], options);
      }
    }
    Object.defineProperty(window, 'Blob', {
      value: SpyBlob,
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    cleanup();
    waveSurferModule.__resetWaveSurferMocks();
    Object.defineProperty(window, 'api', {
      value: originalApi,
      configurable: true,
      writable: true
    });
    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
    Object.defineProperty(window, 'Blob', {
      value: originalBlob,
      configurable: true,
      writable: true
    });
  });

  it('opens modal and focuses Play', async () => {
    renderModal(sampleFile);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    waveInstances[0].emit('ready');

    const playButton = (await screen.findByRole('button', { name: 'Play' })) as HTMLButtonElement;
    await waitFor(() => expect(document.activeElement).toBe(playButton));
  });

  it('shows Loading then Ready on ws ready', async () => {
    renderModal(sampleFile);

    const loadingMessages = await screen.findAllByText('Loading preview…');
    expect(loadingMessages.length).toBeGreaterThan(0);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    waveInstances[0].emit('ready');

    await waitFor(() => expect(screen.queryByText('Loading preview…')).toBeNull());
    await waitFor(() => expect(screen.getAllByText('Ready').length).toBeGreaterThan(0));
  });

  it('play/pause toggles aria-pressed and calls ws.playPause', async () => {
    renderModal(sampleFile);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    const wave = waveInstances[0];
    wave.emit('ready');

    const playButton = (await screen.findByRole('button', { name: 'Play' })) as HTMLButtonElement;
    expect(playButton.getAttribute('aria-pressed')).toBe('false');

    playButton.click();
    await waitFor(() => expect(playButton.getAttribute('aria-pressed')).toBe('true'));
    expect(wave.playPause).toHaveBeenCalledTimes(1);

    playButton.click();
    await waitFor(() => expect(playButton.getAttribute('aria-pressed')).toBe('false'));
    expect(wave.playPause).toHaveBeenCalledTimes(2);
  });

  it('seek slider calls ws.seekTo with correct fraction', async () => {
    renderModal(sampleFile);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    const wave = waveInstances[0] as unknown as {
      emit: (event: string, ...args: unknown[]) => void;
      getDuration: () => number;
      seekTo: ReturnType<typeof vi.fn>;
    };
    wave.getDuration = vi.fn(() => 10);
    expect(wave.getDuration()).toBe(10);
    wave.emit('ready');

    const seekSlider = (await screen.findByRole('slider', {
      name: 'Seek within preview'
    })) as HTMLInputElement;
    await waitFor(() => expect(seekSlider.disabled).toBe(false));
    seekSlider.max = '10';
    Object.defineProperty(seekSlider, 'value', {
      configurable: true,
      get: () => '5',
      // JSDOM clamps <input type="range"> values to the current max, so override the getter
      // to reflect the value we want to send through React's synthetic change event.
      set: () => {}
    });
    fireEvent.change(seekSlider);
    await waitFor(() => expect(wave.seekTo).toHaveBeenCalledWith(0.5));
  });

  it('close destroys ws and tears down audio', async () => {
    renderModal(sampleFile);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    const wave = waveInstances[0];
    wave.emit('ready');

    const closeButton = await screen.findByRole('button', { name: 'Close' });
    closeButton.click();

    await waitFor(() => {
      expect(wave.destroy).toHaveBeenCalled();
      expect(window.api?.teardownAudio).toHaveBeenCalled();
    });
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('loads the preview blob directly when supported', async () => {
    renderModal(sampleFile);

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    const wave = waveInstances[0] as unknown as {
      loadBlob: ReturnType<typeof vi.fn>;
      load: ReturnType<typeof vi.fn>;
    };

    await waitFor(() => expect(wave.loadBlob).toHaveBeenCalledTimes(1));
    expect(wave.load).not.toHaveBeenCalled();
    expect(window.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('no hard-coded strings; i18n keys resolved', async () => {
    renderModal(sampleFile);

    await waitFor(() => {
      expect(screen.getAllByText('Audio preview').length).toBeGreaterThan(0);
    });

    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(1));
    const status = screen.getByRole('status');
    expect(status.textContent ?? '').toContain('Loading preview…');

    const waveInstances = waveSurferModule.__getWaveSurferInstances();
    await waitFor(() => expect(waveInstances.length).toBeGreaterThan(0));
    waveInstances[0].emit('ready');

    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Seek within preview' })).toBeTruthy();
    expect(screen.getAllByText('Volume').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Preview volume')).toBeNull();
  });

  it('shows an error message when loading fails', async () => {
    const failingApi = {
      readFileBlob: vi.fn(() => Promise.reject(new Error('nope'))),
      teardownAudio: vi.fn()
    };
    Object.defineProperty(window, 'api', {
      value: failingApi,
      configurable: true,
      writable: true
    });

    renderModal(sampleFile);

    const errorMessage = (await screen.findByRole('alert')) as HTMLElement;
    expect(errorMessage.textContent ?? '').toContain('Cannot decode this file');
    expect(failingApi.readFileBlob).toHaveBeenCalledWith(sampleFile.path);
    await waitFor(() => expect(failingApi.teardownAudio).toHaveBeenCalled());
  });

  it('creates preview blob with detected mime type', async () => {
    const flacFile: FileRow = {
      ...sampleFile,
      name: 'clip.flac',
      path: '/tmp/clip.flac',
      kind: 'flac'
    };

    renderModal(flacFile);

    await waitFor(() => expect(blobSpy).toHaveBeenCalled());
    const [, options] = blobSpy.mock.calls[0];
    expect(options?.type).toBe('audio/flac');
  });
});
