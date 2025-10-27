export type AudioCodec = 'wav_pcm' | 'wav_float' | 'flac' | 'mp3' | 'aac' | 'unknown';

export interface FileMetadata {
  codec?: AudioCodec;
  num_channels?: number;
  suggest_split_mono?: boolean;
}
