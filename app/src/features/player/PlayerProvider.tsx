import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { FileRow } from '../../types/fileRow';
import { clampTime, clampVolume } from './previewUtils';

interface PlayerContextValue {
  file: FileRow | null;
  isOpen: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  open: (file: FileRow) => void;
  close: () => void;
  togglePlayback: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (value: number) => void;
  setProgress: (current: number, duration: number) => void;
  setPlayingState: (playing: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<FileRow | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const open = useCallback((nextFile: FileRow) => {
    setFile(nextFile);
    setIsOpen(true);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsPlaying(false);
    setFile(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const togglePlayback = useCallback(() => {
    setIsPlaying((previous) => !previous);
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      setCurrentTime((previous) => {
        if (duration <= 0) {
          return 0;
        }
        const target = clampTime(seconds, duration);
        return Number.isNaN(target) ? previous : target;
      });
    },
    [duration]
  );

  const setVolume = useCallback((value: number) => {
    const clamped = clampVolume(value);
    setVolumeState(clamped);
  }, []);

  const setProgress = useCallback((current: number, total: number) => {
    const safeDuration = total > 0 && Number.isFinite(total) ? total : 0;
    setDuration(safeDuration);
    if (safeDuration <= 0) {
      setCurrentTime(0);
      setIsPlaying(false);
      return;
    }
    setCurrentTime(clampTime(current, safeDuration));
  }, []);

  const setPlayingState = useCallback((playing: boolean) => {
    setIsPlaying(Boolean(playing));
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      file,
      isOpen,
      isPlaying,
      currentTime,
      duration,
      volume,
      open,
      close,
      togglePlayback,
      seekTo,
      setVolume,
      setProgress,
      setPlayingState
    }),
    [
      close,
      currentTime,
      duration,
      file,
      isOpen,
      isPlaying,
      open,
      seekTo,
      setProgress,
      setVolume,
      setPlayingState,
      togglePlayback,
      volume
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
