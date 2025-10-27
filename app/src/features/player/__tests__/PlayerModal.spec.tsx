import { render, screen, waitFor } from '@testing-library/react';
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

    load() {}

    destroy() {
      this.listeners.clear();
    }

    getDuration() {
      return this.duration;
    }

    getCurrentTime() {
      return this.currentTime;
    }

    isPlaying() {
      return this.playing;
    }

    play() {
      this.playing = true;
      this.emit('play');
      return Promise.resolve();
    }

    pause() {
      this.playing = false;
      this.emit('pause');
    }

    seekTo(progress: number) {
      this.currentTime = this.duration * progress;
      this.emit('seek', progress);
    }

    setVolume() {}
  }

  const instances: FakeWaveSurfer[] = [];
  const factory = vi.fn(() => {
    const instance = new FakeWaveSurfer();
    instances.push(instance);
    return instance;
  });

  return {
    __esModule: true,
    createWaveSurfer: factory,
    __getWaveSurferInstances: () => instances
  };
});

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

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  afterEach(() => {
    Object.defineProperty(window, 'api', {
      value: originalApi,
      configurable: true,
      writable: true
    });
    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('renders loading state until the waveform is ready', async () => {
    renderModal(sampleFile);

    const loadingMessage = screen.getByText('Loading preview…');
    expect(loadingMessage).toBeDefined();

    const createWaveSurferMock = vi.mocked(createWaveSurfer);
    await waitFor(() => expect(createWaveSurferMock).toHaveBeenCalled());
    const instance = createWaveSurferMock.mock.results[0].value as unknown as {
      emit: (event: string, ...args: unknown[]) => void;
    };

    instance.emit('ready');

    await waitFor(() => expect(screen.queryByText('Loading preview…')).toBeNull());
    const volumeControl = screen.getByLabelText('Preview volume') as HTMLInputElement;
    expect(volumeControl.disabled).toBe(false);
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

    const errorMessages = await screen.findAllByText('Could not decode audio preview.');
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(failingApi.readFileBlob).toHaveBeenCalledWith(sampleFile.path);
    await waitFor(() => expect(failingApi.teardownAudio).toHaveBeenCalled());
  });
});
