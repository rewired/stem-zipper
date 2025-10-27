declare module 'wavesurfer.js' {
  type WaveSurferEvent =
    | 'ready'
    | 'audioprocess'
    | 'seek'
    | 'play'
    | 'pause'
    | 'finish'
    | 'error';

  interface WaveSurferOptions {
    container: HTMLElement;
    waveColor?: string;
    progressColor?: string;
    cursorWidth?: number;
    normalize?: boolean;
    interact?: boolean;
    backend?: string;
  }

  export default class WaveSurfer {
    static create(options: WaveSurferOptions): WaveSurfer;
    load(url: string): void;
    destroy(): void;
    on(event: WaveSurferEvent, listener: (...args: unknown[]) => void): void;
    un(event: WaveSurferEvent, listener: (...args: unknown[]) => void): void;
    getDuration(): number;
    getCurrentTime(): number;
    isPlaying(): boolean;
    play(): Promise<void> | void;
    pause(): void;
    seekTo(progress: number): void;
    setVolume(volume: number): void;
  }
}
