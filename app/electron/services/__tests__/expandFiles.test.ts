import { afterEach, describe, expect, it, vi } from 'vitest';
import { expandFiles } from '../pack/expandFiles';
import { UnsupportedWavError } from '../pack/splitStereo';
import type { SizedFile } from '../pack/types';
import { formatPathForDisplay } from '../../../common/paths';

vi.mock('../audioProbe', () => ({
  probeAudio: vi.fn()
}));

import { probeAudio } from '../audioProbe';

const probeAudioMock = vi.mocked(probeAudio);

function makeSizedFile(pathName: string, size: number): SizedFile {
  return { path: pathName, size, extension: '.wav' };
}

afterEach(() => {
  probeAudioMock.mockReset();
});

describe('expandFiles', () => {
  it('splits stereo WAV files when the probe confirms stereo', async () => {
    const file = makeSizedFile('/audio/stereo.wav', 10_000_000);
    probeAudioMock.mockResolvedValue({ codec: 'wav_pcm', num_channels: 2, size_bytes: file.size, ext: '.wav', path: file.path });
    const splitResult: SizedFile[] = [
      { path: '/audio/stereo_L.wav', size: 5_000_000, extension: '.wav' },
      { path: '/audio/stereo_R.wav', size: 5_000_000, extension: '.wav' }
    ];
    const splitter = vi.fn().mockResolvedValue(splitResult);
    const emitToast = vi.fn();
    const progress = {
      start: vi.fn(),
      tick: vi.fn(),
      fileDone: vi.fn(),
      done: vi.fn(),
      error: vi.fn()
    };

    const result = await expandFiles([file], { maxSizeBytes: 1, progress, emitToast, splitter });

    expect(result).toEqual(splitResult);
    expect(splitter).toHaveBeenCalledWith(file.path);
    expect(emitToast).not.toHaveBeenCalled();
    expect(progress.tick).toHaveBeenCalledWith(expect.objectContaining({ state: 'preparing' }));
  });

  it('skips splitting when the probe indicates a non-WAV payload', async () => {
    const file = makeSizedFile('/audio/fake.wav', 8_000_000);
    probeAudioMock.mockResolvedValue({ codec: 'mp3', size_bytes: file.size, ext: '.wav', path: file.path });
    const splitter = vi.fn();
    const emitToast = vi.fn();

    const result = await expandFiles([file], {
      maxSizeBytes: 1,
      emitToast,
      splitter
    });

    expect(result).toEqual([file]);
    expect(splitter).not.toHaveBeenCalled();
    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        messageKey: 'pack_info_skip_stereo_split_non_wav',
        params: { file: formatPathForDisplay(file.path) }
      })
    );
  });

  it('skips splitting when WaveFile reports an unsupported layout', async () => {
    const file = makeSizedFile('/audio/mono.wav', 9_000_000);
    probeAudioMock.mockResolvedValue({
      codec: 'wav_pcm',
      num_channels: 2,
      size_bytes: file.size,
      ext: '.wav',
      path: file.path
    });
    const splitter = vi.fn().mockRejectedValue(new UnsupportedWavError('channels=1'));
    const emitToast = vi.fn();

    const result = await expandFiles([file], {
      maxSizeBytes: 1,
      emitToast,
      splitter
    });

    expect(result).toEqual([file]);
    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        messageKey: 'pack_info_skip_stereo_split_non_wav'
      })
    );
  });

  it('skips the file entirely when splitting throws an unexpected error', async () => {
    const file = makeSizedFile('/audio/broken.wav', 9_000_000);
    probeAudioMock.mockResolvedValue({
      codec: 'wav_pcm',
      num_channels: 2,
      size_bytes: file.size,
      ext: '.wav',
      path: file.path
    });
    const splitter = vi.fn().mockRejectedValue(new Error('filesystem offline'));
    const emitToast = vi.fn();

    const result = await expandFiles([file], {
      maxSizeBytes: 1,
      emitToast,
      splitter
    });

    expect(result).toEqual([]);
    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        messageKey: 'pack_warn_file_skipped',
        params: { file: formatPathForDisplay(file.path) }
      })
    );
  });

  it('emits a split-mono failure toast when a forced split fails', async () => {
    const file = makeSizedFile('/audio/forced.wav', 9_000_000);
    probeAudioMock.mockResolvedValue({
      codec: 'wav_pcm',
      num_channels: 2,
      size_bytes: file.size,
      ext: '.wav',
      path: file.path
    });
    const splitter = vi.fn().mockRejectedValue(new Error('disk unavailable'));
    const emitToast = vi.fn();

    const result = await expandFiles([file], {
      maxSizeBytes: 50 * 1024 * 1024,
      emitToast,
      splitter,
      forceSplit: new Set([file.path])
    });

    expect(result).toEqual([]);
    expect(emitToast).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        messageKey: 'warn_split_mono_failed',
        params: { name: formatPathForDisplay(file.path) }
      })
    );
  });
});
