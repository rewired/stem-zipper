import fs from 'node:fs';
import path from 'node:path';
import { WaveFile } from 'wavefile';
import type { SizedFile } from './types';

const WAV_FORMAT_PCM = 1;
const WAV_FORMAT_IEEE_FLOAT = 3;

export class UnsupportedWavError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedWavError';
  }
}

async function getSizedFile(filePath: string): Promise<SizedFile> {
  const stats = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== '.wav') {
    throw new UnsupportedWavError(`Split stereo output has unexpected extension: ${extension}`);
  }
  return { path: filePath, size: stats.size, extension };
}

export async function splitStereoWav(filePath: string): Promise<SizedFile[]> {
  const buffer = await fs.promises.readFile(filePath);
  const wav = new WaveFile(buffer);
  const fmt = wav.fmt as { audioFormat?: number; numChannels?: number; sampleRate?: number } | undefined;
  const numChannels = fmt?.numChannels;
  const audioFormat = fmt?.audioFormat;

  if (numChannels !== 2) {
    throw new UnsupportedWavError(`Expected stereo WAV but found channels=${numChannels ?? 'unknown'}`);
  }

  if (audioFormat !== WAV_FORMAT_PCM && audioFormat !== WAV_FORMAT_IEEE_FLOAT) {
    throw new UnsupportedWavError(`Unsupported WAV audio format: ${audioFormat ?? 'unknown'}`);
  }

  const sampler = (wav as unknown as {
    getSamples?: (interleaved: false, OutputObject: { new (...args: unknown[]): Float64Array }) => Float64Array[];
  }).getSamples;

  if (typeof sampler !== 'function') {
    throw new UnsupportedWavError('WaveFile#getSamples is not available');
  }

  const channels = sampler.call(wav, false, Float64Array);

  if (!Array.isArray(channels) || channels.length < 2) {
    throw new UnsupportedWavError('WaveFile#getSamples did not return stereo channels');
  }

  const [leftSamples, rightSamples] = channels;
  if (!leftSamples || !rightSamples) {
    throw new UnsupportedWavError('Stereo channels are missing sample data');
  }

  const sampleRate = fmt?.sampleRate ?? 44100;
  const bitDepthCode = (typeof wav.bitDepth === 'string' && wav.bitDepth) || '16';
  const { dir, name, ext } = path.parse(filePath);
  const leftPath = path.join(dir, `${name}_L${ext}`);
  const rightPath = path.join(dir, `${name}_R${ext}`);
  const created: string[] = [];

  try {
    const left = new WaveFile();
    left.fromScratch(1, sampleRate, bitDepthCode, [leftSamples]);
    await fs.promises.writeFile(leftPath, left.toBuffer());
    created.push(leftPath);

    const right = new WaveFile();
    right.fromScratch(1, sampleRate, bitDepthCode, [rightSamples]);
    await fs.promises.writeFile(rightPath, right.toBuffer());
    created.push(rightPath);

    await fs.promises.unlink(filePath);
  } catch (error) {
    await Promise.all(
      created.map((outputPath) =>
        fs.promises
          .unlink(outputPath)
          .catch((unlinkError) =>
            console.warn('Failed to clean up partial WAV split output', outputPath, unlinkError)
          )
      )
    );
    throw error;
  }

  return Promise.all([getSizedFile(leftPath), getSizedFile(rightPath)]);
}
