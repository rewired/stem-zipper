import fs from 'node:fs/promises';
import { WaveFile } from 'wavefile';

export type AudioProbeKind = 'wav' | 'mp3' | 'other';

export interface AudioProbeResult {
  kind: AudioProbeKind;
  stereo?: boolean;
}

const WAV_SIGNATURE_LENGTH = 12;
const MP3_FRAME_SYNC = 0xe0;

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

export async function probeAudio(filePath: string): Promise<AudioProbeResult> {
  const header = Buffer.alloc(WAV_SIGNATURE_LENGTH);
  let handle: fs.FileHandle | null = null;

  try {
    handle = await fs.open(filePath, 'r');
    const { bytesRead } = await handle.read(header, 0, WAV_SIGNATURE_LENGTH, 0);

    if (isWaveSignature(header, bytesRead)) {
      try {
        const buffer = await fs.readFile(filePath);
        const wav = new WaveFile(buffer);
        const channels = typeof wav.fmt?.numChannels === 'number' ? wav.fmt.numChannels : undefined;
        return {
          kind: 'wav',
          stereo: channels === 2 ? true : channels === undefined ? undefined : false
        };
      } catch (error) {
        console.warn('Failed to parse WAV during audio probe', filePath, error);
        return { kind: 'wav' };
      }
    }

    if (isId3Tag(header, bytesRead) || hasMp3FrameSync(header, bytesRead)) {
      return { kind: 'mp3' };
    }

    return { kind: 'other' };
  } catch (error) {
    console.warn('Failed to probe audio header', filePath, error);
    return { kind: 'other' };
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
