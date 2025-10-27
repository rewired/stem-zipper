export default class WaveSurferMock {
  static create(): WaveSurferMock {
    return new WaveSurferMock();
  }

  private duration = 0;
  private currentTime = 0;
  private playing = false;

  on(): void {}
  un(): void {}
  load(): void {}
  destroy(): void {}

  getDuration(): number {
    return this.duration;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  play(): Promise<void> {
    this.playing = true;
    return Promise.resolve();
  }

  pause(): void {
    this.playing = false;
  }

  seekTo(): void {}
  setVolume(): void {}
}
