import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { probeAudio } from '../audioProbe';
import type { SizedFile } from './types';

const WAV_FORMAT_PCM = 1;
const WAV_FORMAT_IEEE_FLOAT = 3;
const DEFAULT_HEADER_BYTES = 44;

export class UnsupportedWavError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedWavError';
  }
}

function createMonoHeader(audioFormat: number, sampleRate: number, bitsPerSample: number, dataSize: number): Buffer {
  const bytesPerSample = Math.ceil(bitsPerSample / 8);
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(DEFAULT_HEADER_BYTES);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(audioFormat, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return header;
}

async function ensureStreamClosed(stream: fs.WriteStream): Promise<void> {
  if (stream.closed) {
    return;
  }
  stream.end();
  await once(stream, 'close');
}

export interface SplitStereoWavOptions {
  registerTemp?: (artifactPath: string) => void;
  onProgress?: (fractionComplete: number) => void;
}

export async function splitStereoWav(
  filePath: string,
  options?: SplitStereoWavOptions
): Promise<SizedFile[]> {
  const registerTemp = typeof options?.registerTemp === 'function' ? options.registerTemp : undefined;
  const reportProgress = typeof options?.onProgress === 'function' ? options.onProgress : undefined;
  const stats = await fs.promises.stat(filePath);
  const probe = await probeAudio(filePath);

  if (probe.codec !== 'wav_pcm' && probe.codec !== 'wav_float') {
    throw new UnsupportedWavError(`Unsupported WAV codec: ${probe.codec}`);
  }
  if (probe.num_channels !== 2) {
    throw new UnsupportedWavError(`Expected stereo WAV but found channels=${probe.num_channels ?? 'unknown'}`);
  }
  const sampleRate = probe.sample_rate;
  if (typeof sampleRate !== 'number' || sampleRate <= 0) {
    throw new UnsupportedWavError('Missing sample rate in WAV header');
  }
  const bitsPerSample = probe.bit_depth;
  if (typeof bitsPerSample !== 'number' || bitsPerSample <= 0) {
    throw new UnsupportedWavError('Missing bit depth in WAV header');
  }
  const bytesPerSample = Math.ceil(bitsPerSample / 8);
  const dataOffset = typeof probe.data_offset === 'number' ? probe.data_offset : DEFAULT_HEADER_BYTES;
  const headerBytes = typeof probe.header_bytes === 'number' ? probe.header_bytes : DEFAULT_HEADER_BYTES;
  const dataBytes = Math.max(0, stats.size - headerBytes);
  const frameSize = bytesPerSample * 2;
  const frameCount = Math.floor(dataBytes / frameSize);
  if (frameCount === 0) {
    throw new UnsupportedWavError('WAV payload is too small to split');
  }
  const monoDataSize = frameCount * bytesPerSample;

  const audioFormat = probe.codec === 'wav_float' ? WAV_FORMAT_IEEE_FLOAT : WAV_FORMAT_PCM;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-split-'));
  const { name } = path.parse(filePath);
  const leftPath = path.join(tempDir, `${name}-L.wav`);
  const rightPath = path.join(tempDir, `${name}-R.wav`);
  const createdArtifacts = [leftPath, rightPath, tempDir];

  try {
    const leftStream = fs.createWriteStream(leftPath);
    const rightStream = fs.createWriteStream(rightPath);
    leftStream.write(createMonoHeader(audioFormat, sampleRate, bitsPerSample, monoDataSize));
    rightStream.write(createMonoHeader(audioFormat, sampleRate, bitsPerSample, monoDataSize));

    const readStream = fs.createReadStream(filePath, {
      start: dataOffset,
      end: dataOffset + frameCount * frameSize - 1
    });

    await new Promise<void>((resolve, reject) => {
      let remainder = Buffer.alloc(0);
      let processing: Promise<void> = Promise.resolve();
      let settled = false;
      let framesProcessed = 0;
      const framesPerReport = Math.max(1, Math.floor(frameCount / 50));
      let nextReportFrame = framesPerReport;

      const emitProgress = (force = false) => {
        if (!reportProgress) {
          return;
        }
        if (!force && framesProcessed < nextReportFrame) {
          return;
        }
        const ratio = frameCount === 0 ? 1 : Math.min(1, framesProcessed / frameCount);
        reportProgress(ratio);
        nextReportFrame = framesProcessed + framesPerReport;
      };

      const handleFailure = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        readStream.destroy();
        leftStream.destroy();
        rightStream.destroy();
        reject(error);
      };

      const processChunk = async (chunk: Buffer) => {
        const combined = remainder.length > 0 ? Buffer.concat([remainder, chunk]) : chunk;
        const usableLength = Math.floor(combined.length / frameSize) * frameSize;
        remainder = combined.subarray(usableLength);

        for (let offset = 0; offset < usableLength; offset += frameSize) {
          const leftSample = combined.subarray(offset, offset + bytesPerSample);
          const rightSample = combined.subarray(offset + bytesPerSample, offset + frameSize);

          if (!leftStream.write(leftSample)) {
            await once(leftStream, 'drain');
          }
          if (!rightStream.write(rightSample)) {
            await once(rightStream, 'drain');
          }
        }
        framesProcessed += usableLength / frameSize;
        emitProgress();
      };

      const handleStreamError = (error: Error | unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        handleFailure(err);
      };

      readStream.on('data', (chunk) => {
        readStream.pause();
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, 'binary');
        processing = processing
          .then(() => processChunk(bufferChunk))
          .then(() => {
            if (!settled) {
              readStream.resume();
            }
          });

        processing.catch(handleStreamError);
      });

      readStream.on('end', () => {
        processing
          .then(async () => {
            if (remainder.length > 0) {
              console.warn('Dropping incomplete WAV frame during split', filePath);
            }
            await Promise.all([ensureStreamClosed(leftStream), ensureStreamClosed(rightStream)]);
            emitProgress(true);
            if (!settled) {
              settled = true;
              resolve();
            }
          })
          .catch(handleStreamError);
      });

      readStream.on('error', handleStreamError);
      leftStream.on('error', handleStreamError);
      rightStream.on('error', handleStreamError);
    });

    const [leftStats, rightStats] = await Promise.all([fs.promises.stat(leftPath), fs.promises.stat(rightPath)]);
    if (registerTemp) {
      for (const artifact of createdArtifacts) {
        registerTemp(artifact);
      }
    }
    return [
      { path: leftPath, size: leftStats.size, extension: '.wav' },
      { path: rightPath, size: rightStats.size, extension: '.wav' }
    ];
  } catch (error) {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch((cleanupError) => {
      console.warn('Failed to clean up temp WAV split directory', tempDir, cleanupError);
    });
    throw error;
  }
}
