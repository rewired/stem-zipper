import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';
import type { AudioCodec } from '../../common/types';

export interface ProbedAudio {
  path: string;
  ext: string;
  codec: AudioCodec;
  sample_rate?: number;
  bit_depth?: number;
  num_channels?: number;
  duration_sec?: number;
  size_bytes: number;
  header_bytes?: number;
  data_offset?: number;
}

const WAV_SIGNATURE_LENGTH = 12;
const WAV_HEADER_MIN_LENGTH = 44;
const WAV_FMT_CHUNK_ID = 'fmt ';
const WAV_DATA_CHUNK_ID = 'data';
const PCM_FORMAT_CODE = 1;
const FLOAT_FORMAT_CODE = 3;

const MP3_FRAME_SYNC = 0xe0;

export function isWavPcm(result: ProbedAudio): boolean {
  return result.codec === 'wav_pcm';
}

export function numChannels(result: ProbedAudio): number | undefined {
  return typeof result.num_channels === 'number' ? result.num_channels : undefined;
}

export function bytesPerSample(result: ProbedAudio): number | undefined {
  if (typeof result.bit_depth === 'number' && result.bit_depth > 0) {
    return result.bit_depth / 8;
  }
  return undefined;
}

function isWaveSignature(buffer: Buffer, bytesRead: number): boolean {
  if (bytesRead < WAV_SIGNATURE_LENGTH) {
    return false;
  }
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
}

function isId3Tag(buffer: Buffer, bytesRead: number): boolean {
  return bytesRead >= 3 && buffer.toString('ascii', 0, 3) === 'ID3';
}

function hasMp3FrameSync(buffer: Buffer, bytesRead: number): boolean {
  if (bytesRead < 2) {
    return false;
  }
  return buffer[0] === 0xff && (buffer[1] & MP3_FRAME_SYNC) === MP3_FRAME_SYNC;
}

async function statSafe(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    console.warn('Failed to stat audio file during probe', filePath, error);
    return null;
  }
}

interface ParsedWaveFmt {
  audioFormat?: number;
  numChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  byteRate?: number;
}

async function parseWaveMetadata(handle: fs.FileHandle, size: number): Promise<{
  fmt: ParsedWaveFmt;
  dataBytes?: number;
  dataOffset?: number;
}> {
  const fmt: ParsedWaveFmt = {};
  let dataBytes: number | undefined;
  let dataOffset: number | undefined;
  let offset = WAV_SIGNATURE_LENGTH;
  const chunkHeader = Buffer.alloc(8);

  while (offset + 8 <= size) {
    const { bytesRead } = await handle.read(chunkHeader, 0, 8, offset);
    if (bytesRead < 8) {
      break;
    }
    const chunkId = chunkHeader.toString('ascii', 0, 4);
    const chunkSize = chunkHeader.readUInt32LE(4);
    const paddedSize = chunkSize + (chunkSize % 2);
    if (chunkId === WAV_FMT_CHUNK_ID) {
      if (chunkSize < 16) {
        offset += 8 + paddedSize;
        continue;
      }
      const fmtBuffer = Buffer.alloc(Math.min(chunkSize, 32));
      const fmtRead = await handle.read(fmtBuffer, 0, fmtBuffer.length, offset + 8);
      if (fmtRead.bytesRead >= 16) {
        fmt.audioFormat = fmtBuffer.readUInt16LE(0);
        fmt.numChannels = fmtBuffer.readUInt16LE(2);
        fmt.sampleRate = fmtBuffer.readUInt32LE(4);
        fmt.byteRate = fmtBuffer.readUInt32LE(8);
        fmt.bitsPerSample = fmtBuffer.readUInt16LE(14);
      }
    } else if (chunkId === WAV_DATA_CHUNK_ID) {
      dataBytes = chunkSize;
      dataOffset = offset + 8;
    }
    if (paddedSize <= 0) {
      break;
    }
    offset += 8 + paddedSize;
  }

  return { fmt, dataBytes, dataOffset };
}

function resolveCodec(ext: string, formatCode?: number): AudioCodec {
  if (ext === '.wav') {
    if (formatCode === PCM_FORMAT_CODE) {
      return 'wav_pcm';
    }
    if (formatCode === FLOAT_FORMAT_CODE) {
      return 'wav_float';
    }
    return 'unknown';
  }
  if (ext === '.flac') {
    return 'flac';
  }
  if (ext === '.mp3') {
    return 'mp3';
  }
  if (ext === '.aac' || ext === '.m4a') {
    return 'aac';
  }
  return 'unknown';
}

export async function probeAudio(filePath: string): Promise<ProbedAudio> {
  const ext = path.extname(filePath).toLowerCase();
  const stats = await statSafe(filePath);
  const size = stats?.size ?? 0;
  const fallback: ProbedAudio = {
    path: filePath,
    ext,
    codec: resolveCodec(ext),
    size_bytes: size
  };

  const header = Buffer.alloc(WAV_SIGNATURE_LENGTH);
  let handle: fs.FileHandle | null = null;

  try {
    handle = await fs.open(filePath, 'r');
    const { bytesRead } = await handle.read(header, 0, WAV_SIGNATURE_LENGTH, 0);

    if (isWaveSignature(header, bytesRead)) {
      if (size < WAV_HEADER_MIN_LENGTH) {
        return { ...fallback, codec: 'unknown' };
      }

      const { fmt, dataBytes, dataOffset } = await parseWaveMetadata(handle, size);
      const codec = resolveCodec(ext, fmt.audioFormat);
      const bitDepth = typeof fmt.bitsPerSample === 'number' ? fmt.bitsPerSample : undefined;
      const numChannelsValue = typeof fmt.numChannels === 'number' ? fmt.numChannels : undefined;
      const byteRate = typeof fmt.byteRate === 'number' ? fmt.byteRate : undefined;
      const duration = byteRate && dataBytes ? dataBytes / byteRate : undefined;
      const headerBytes = dataBytes ? Math.max(0, size - dataBytes) : undefined;

      return {
        ...fallback,
        codec,
        sample_rate: fmt.sampleRate,
        bit_depth: bitDepth,
        num_channels: numChannelsValue,
        duration_sec: duration,
        header_bytes: headerBytes,
        data_offset: dataOffset
      };
    }

    if (isId3Tag(header, bytesRead) || hasMp3FrameSync(header, bytesRead)) {
      return { ...fallback, codec: 'mp3' };
    }

    return fallback;
  } catch (error) {
    console.warn('Failed to probe audio header', filePath, error);
    return fallback;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch (closeError) {
        console.warn('Failed to close audio probe handle', filePath, closeError);
      }
    }
  }
}
