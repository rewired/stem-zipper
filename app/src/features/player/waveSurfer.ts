import WaveSurfer from 'wavesurfer.js';

const DEFAULT_WAVE_COLOR = '#64748b';
const DEFAULT_PROGRESS_COLOR = '#34d399';

type TokenName = 'wave-color' | 'wave-progress-color';

function resolveColorToken(name: TokenName, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const root = document.documentElement;
  if (!root) {
    return fallback;
  }

  try {
    const value = getComputedStyle(root).getPropertyValue(`--player-${name}`).trim();
    return value.length > 0 ? value : fallback;
  } catch (error) {
    console.warn('Failed to resolve player color token', name, error);
    return fallback;
  }
}

export function getWaveColor(): string {
  return resolveColorToken('wave-color', DEFAULT_WAVE_COLOR);
}

export function getWaveProgressColor(): string {
  return resolveColorToken('wave-progress-color', DEFAULT_PROGRESS_COLOR);
}

export function createWaveSurfer(container: HTMLElement): WaveSurfer {
  return WaveSurfer.create({
    container,
    waveColor: getWaveColor(),
    progressColor: getWaveProgressColor(),
    cursorWidth: 1,
    normalize: true,
    interact: true,
    backend: 'WebAudio'
  });
}

export { resolveColorToken };
