import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';
import { tNS } from '@common/i18n';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { useAppStore } from '../../store/appStore';
import { usePlayer } from './PlayerProvider';

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
    volume
  } = usePlayer();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const modalLabel = useMemo(() => tNS('player', 'modal_label', undefined, locale), [locale]);
  const playPauseLabel = useMemo(
    () => tNS('player', 'play_pause_button_label', undefined, locale),
    [locale]
  );
  const seekLabel = useMemo(() => tNS('player', 'seek_slider_label', undefined, locale), [locale]);
  const volumeLabel = useMemo(
    () => tNS('player', 'volume_slider_label', undefined, locale),
    [locale]
  );
  const closeLabel = useMemo(() => tNS('player', 'close_button_label', undefined, locale), [locale]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      playButtonRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus({ preventScroll: true });
      previouslyFocused.current = null;
    };
  }, [isOpen]);

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
        togglePlayback();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekTo(currentTime - 5);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekTo(currentTime + 5);
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
  }, [close, currentTime, isOpen, seekTo, setVolume, togglePlayback, volume]);

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

  if (!isOpen || !file) {
    return null;
  }

  const timeDisplay = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  const maxSeek = duration > 0 ? duration : 0;
  const seekValue = maxSeek > 0 ? currentTime : 0;
  const volumeValue = Math.round(Math.min(1, Math.max(0, volume)) * 100);

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
        aria-label={modalLabel}
        className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{file.name}</h2>
            <p className="mt-1 font-mono text-sm text-slate-300" aria-live="polite">
              {timeDisplay}
            </p>
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
          ref={waveRef}
          id="wave"
          className="mt-4 h-40 rounded-md bg-slate-800/80 shadow-inner md:h-48"
        />
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <button
              ref={playButtonRef}
              type="button"
              onClick={togglePlayback}
              aria-label={playPauseLabel}
              className={clsx(
                'inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-200 transition hover:bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
                isPlaying && 'bg-emerald-600 text-white hover:bg-emerald-500'
              )}
            >
              <MaterialIcon icon={isPlaying ? 'pause' : 'play_arrow'} />
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
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) {
                    seekTo(nextValue);
                  }
                }}
                aria-label={seekLabel}
                disabled={maxSeek === 0}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400"
              />
            </div>
            <div className="flex items-center gap-2 md:ml-4">
              <span className="text-sm text-slate-300" aria-hidden="true">
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
                aria-label={volumeLabel}
                className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-slate-700 focus-visible:ring focus-visible:ring-emerald-400"
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
