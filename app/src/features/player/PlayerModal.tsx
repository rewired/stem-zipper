import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react';
import { formatMessage, tNS } from '@common/i18n';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { useAppStore } from '../../store/appStore';
import { usePlayer } from './PlayerProvider';
import { MAX_PREVIEW_FILE_SIZE_BYTES, clampTime, clampVolume } from './previewUtils';
import { createWaveSurfer } from './waveSurfer';
import { useToast } from '../../providers/ToastProvider';
import type WaveSurfer from 'wavesurfer.js';

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function PlayerModal() {
  const { locale } = useAppStore();
  const {
    file,
    isOpen,
    close,
    isPlaying,
    togglePlayback,
    currentTime,
    duration,
    seekTo,
    setVolume,
    volume,
    setProgress,
    setPlayingState
  } = usePlayer();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const volumeRef = useRef(volume);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const statusId = useId();
  const volumeLabelId = useId();

  const { show: showToast } = useToast();

  const modalLabel = useMemo(() => tNS('player', 'modal_label', undefined, locale), [locale]);
  const playLabel = useMemo(() => tNS('player', 'button_play', undefined, locale), [locale]);
  const pauseLabel = useMemo(() => tNS('player', 'button_pause', undefined, locale), [locale]);
  const seekLabel = useMemo(() => tNS('player', 'seek_slider_label', undefined, locale), [locale]);
  const volumeLabel = useMemo(() => tNS('player', 'label_volume', undefined, locale), [locale]);
  const closeLabel = useMemo(() => tNS('player', 'button_close', undefined, locale), [locale]);
  const loadingMessage = useMemo(() => tNS('player', 'loading', undefined, locale), [locale]);
  const genericErrorMessage = useMemo(
    () => tNS('player', 'error_generic', undefined, locale),
    [locale]
  );
  const decodeFailedMessage = useMemo(
    () => tNS('player', 'error_decode_failed', undefined, locale),
    [locale]
  );
  const currentTimeLabel = useMemo(
    () => tNS('player', 'label_time_current', undefined, locale),
    [locale]
  );
  const durationLabel = useMemo(
    () => tNS('player', 'label_time_duration', undefined, locale),
    [locale]
  );
  const readyMessage = useMemo(() => formatMessage(locale, 'pack_status_ready'), [locale]);
  const maxPreviewMb = Math.round(MAX_PREVIEW_FILE_SIZE_BYTES / (1024 * 1024));
  const tooLargeMessage = useMemo(
    () => tNS('player', 'error_file_too_large', { max_size: String(maxPreviewMb) }, locale),
    [locale, maxPreviewMb]
  );
  const toastCloseLabel = useMemo(() => formatMessage(locale, 'common_close'), [locale]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const handleTogglePlayback = useCallback(() => {
    const wave = waveSurferRef.current;
    if (wave) {
      const toggle = (wave as WaveSurfer & { playPause?: () => void }).playPause;
      if (typeof toggle === 'function') {
        toggle.call(wave);
        return;
      }
      if (wave.isPlaying()) {
        wave.pause();
      } else {
        void wave.play();
      }
      return;
    }
    togglePlayback();
  }, [togglePlayback]);

  const handleSeek = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds)) {
        return;
      }
      const wave = waveSurferRef.current;
      const measured = wave?.getDuration();
      const total = Number.isFinite(measured) && measured !== undefined ? measured : duration;
      const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
      const target = clampTime(seconds, safeTotal);
      if (wave && safeTotal > 0) {
        wave.seekTo(target / safeTotal);
      }
      seekTo(target);
    },
    [duration, seekTo]
  );

  const handleSeekInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);
      handleSeek(nextValue);
    },
    [handleSeek]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus({ preventScroll: true });
      previouslyFocused.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || status !== 'ready') {
      return;
    }
    const timer = window.setTimeout(() => {
      playButtonRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, status]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        handleTogglePlayback();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSeek(currentTime - 5);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSeek(currentTime + 5);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setVolume(volume + 0.05);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setVolume(volume - 0.05);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, currentTime, handleSeek, handleTogglePlayback, isOpen, setVolume, volume]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const node = dialogRef.current;
    if (!node) {
      return;
    }

    const handleTabTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', handleTabTrap);
    return () => node.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !file) {
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    const container = waveRef.current;
    if (!container) {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setPlayingState(false);
    setProgress(0, 0);

    const previousWave = waveSurferRef.current;
    if (previousWave) {
      previousWave.destroy();
      waveSurferRef.current = null;
    }
    container.innerHTML = '';
    const previousUrl = objectUrlRef.current;
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlRef.current = null;
    }

    let disposed = false;
    let detachListeners: (() => void) | null = null;

    const handleError = (message: string) => {
      if (disposed) {
        return;
      }
      if (detachListeners) {
        detachListeners();
        detachListeners = null;
      }
      const url = objectUrlRef.current;
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      setPlayingState(false);
      setProgress(0, 0);
      setStatus('error');
      setErrorMessage(message);
      showToast({
        id: 'player-preview-error',
        title: modalLabel,
        message,
        closeLabel: toastCloseLabel,
        timeoutMs: 15000
      });
      window.api?.teardownAudio?.();
    };

    const loadWaveform = async () => {
      if (file.sizeBytes > MAX_PREVIEW_FILE_SIZE_BYTES) {
        handleError(tooLargeMessage);
        return;
      }

      if (!window.api?.readFileBlob) {
        handleError(genericErrorMessage);
        return;
      }

      try {
        const buffer = await window.api.readFileBlob(file.path);
        if (disposed) {
          return;
        }
        const blob = new Blob([buffer]);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const wave = createWaveSurfer(container);
        waveSurferRef.current = wave;

        const readyListener = () => {
          if (disposed) {
            return;
          }
          const measured = wave.getDuration();
          const total = Number.isFinite(measured) && measured > 0 ? measured : 0;
          wave.setVolume(clampVolume(volumeRef.current));
          setProgress(0, total);
          setStatus('ready');
          setErrorMessage(null);
        };

        const audioProcessListener = () => {
          if (disposed) {
            return;
          }
          const total = wave.getDuration();
          const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
          setProgress(wave.getCurrentTime(), safeTotal);
        };

        const seekListener = (value: unknown) => {
          if (disposed) {
            return;
          }
          const progress = typeof value === 'number' ? value : Number(value);
          const normalized = Number.isFinite(progress) && progress >= 0 ? Math.min(1, progress) : 0;
          const total = wave.getDuration();
          const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
          setProgress(normalized * safeTotal, safeTotal);
        };

        const playListener = () => {
          if (disposed) {
            return;
          }
          setPlayingState(true);
        };

        const pauseListener = () => {
          if (disposed) {
            return;
          }
          setPlayingState(false);
        };

        const finishListener = () => {
          if (disposed) {
            return;
          }
          const total = wave.getDuration();
          const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
          setPlayingState(false);
          setProgress(safeTotal, safeTotal);
        };

        const errorListener = () => {
          if (disposed) {
            return;
          }
          handleError(decodeFailedMessage);
          wave.destroy();
          waveSurferRef.current = null;
        };

        wave.on('ready', readyListener);
        wave.on('audioprocess', audioProcessListener);
        wave.on('seek', seekListener);
        wave.on('play', playListener);
        wave.on('pause', pauseListener);
        wave.on('finish', finishListener);
        wave.on('error', errorListener);

        detachListeners = () => {
          wave.un('ready', readyListener);
          wave.un('audioprocess', audioProcessListener);
          wave.un('seek', seekListener);
          wave.un('play', playListener);
          wave.un('pause', pauseListener);
          wave.un('finish', finishListener);
          wave.un('error', errorListener);
        };

        wave.load(url);
      } catch (error) {
        console.error('Failed to load audio preview', file.path, error);
        handleError(decodeFailedMessage);
      }
    };

    void loadWaveform();

    return () => {
      disposed = true;
      if (detachListeners) {
        detachListeners();
        detachListeners = null;
      }
      const wave = waveSurferRef.current;
      if (wave) {
        wave.destroy();
        waveSurferRef.current = null;
      }
      const url = objectUrlRef.current;
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      }
      window.api?.teardownAudio?.();
    };
  }, [
    decodeFailedMessage,
    file,
    genericErrorMessage,
    isOpen,
    modalLabel,
    setPlayingState,
    setProgress,
    showToast,
    toastCloseLabel,
    tooLargeMessage
  ]);

  useEffect(() => {
    const wave = waveSurferRef.current;
    if (!wave || status !== 'ready') {
      return;
    }
    if (isPlaying && !wave.isPlaying()) {
      void wave.play();
    }
    if (!isPlaying && wave.isPlaying()) {
      wave.pause();
    }
  }, [isPlaying, status]);

  useEffect(() => {
    const wave = waveSurferRef.current;
    if (!wave) {
      return;
    }
    wave.setVolume(clampVolume(volume));
  }, [volume]);

  if (!isOpen || !file) {
    return null;
  }
  const timeCurrent = formatTime(currentTime);
  const timeDuration = formatTime(duration);
  const maxSeek = duration > 0 ? duration : 0;
  const seekValue = maxSeek > 0 ? currentTime : 0;
  const volumeValue = Math.round(Math.min(1, Math.max(0, volume)) * 100);
  const isReady = status === 'ready';
  const isLoading = status === 'loading';
  const statusMessage = isLoading
    ? loadingMessage
    : status === 'error'
      ? errorMessage ?? genericErrorMessage
      : status === 'ready'
        ? readyMessage
        : '';
  const describedBy = statusMessage ? statusId : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={describedBy}
        className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="text-lg font-semibold text-slate-100">
              {modalLabel}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-300">{file.name}</p>
            <dl className="mt-2 flex flex-wrap gap-4 text-sm text-slate-300" aria-live="polite">
              <div className="flex flex-col">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {currentTimeLabel}
                </dt>
                <dd className="font-mono text-slate-100">{timeCurrent}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {durationLabel}
                </dt>
                <dd className="font-mono text-slate-100">{timeDuration}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <MaterialIcon icon="close" />
          </button>
        </div>
        <div
          className="relative mt-4 h-40 overflow-hidden rounded-md bg-slate-800/80 shadow-inner md:h-48"
          aria-busy={isLoading}
        >
          <div ref={waveRef} id="wave" className="absolute inset-0" />
          {status !== 'ready' && statusMessage ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-sm font-medium text-slate-200"
              aria-hidden="true"
            >
              {statusMessage}
            </div>
          ) : null}
        </div>
        {statusMessage ? (
          <div
            id={statusId}
            className="mt-3 text-sm text-slate-200"
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {statusMessage}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <button
              ref={playButtonRef}
              type="button"
              onClick={handleTogglePlayback}
              aria-label={isPlaying ? pauseLabel : playLabel}
              aria-pressed={isPlaying}
              className={clsx(
                'inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                isPlaying && 'bg-emerald-600 text-white hover:bg-emerald-500',
                !isReady && 'cursor-not-allowed opacity-60'
              )}
              disabled={!isReady}
              title={isPlaying ? pauseLabel : playLabel}
            >
              <MaterialIcon icon={isPlaying ? 'pause' : 'play_arrow'} />
              <span className="sr-only">{isPlaying ? pauseLabel : playLabel}</span>
            </button>
            <div className="flex-1">
              <label className="sr-only" htmlFor="player-seek">
                {seekLabel}
              </label>
              <input
                id="player-seek"
                type="range"
                min={0}
                max={maxSeek}
                step={0.1}
                value={seekValue}
                onChange={handleSeekInput}
                aria-label={seekLabel}
                disabled={!isReady}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400"
              />
            </div>
            <div className="flex items-center gap-2 md:ml-4">
              <span className="text-sm text-slate-300" id={volumeLabelId}>
                {volumeLabel}
              </span>
              <label className="sr-only" htmlFor="player-volume">
                {volumeLabel}
              </label>
              <input
                id="player-volume"
                type="range"
                min={0}
                max={100}
                step={1}
                value={volumeValue}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) {
                    setVolume(nextValue / 100);
                  }
                }}
                aria-labelledby={volumeLabelId}
                className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400"
                disabled={!isReady}
              />
              <span className="w-10 text-right text-xs font-medium text-slate-400" aria-live="polite">
                {volumeValue}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
