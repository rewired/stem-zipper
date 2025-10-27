import { getFileExtension } from '../../utils/path';
import type { FileRow } from '../../types/fileRow';

const PREVIEWABLE_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac']);

const PREVIEW_MIME_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac'
};

export const MAX_PREVIEW_FILE_SIZE_BYTES = 64 * 1024 * 1024;

export function isPreviewable(file: Pick<FileRow, 'path' | 'sizeBytes'>): boolean {
  const extension = getFileExtension(file.path);
  if (!extension || !PREVIEWABLE_EXTENSIONS.has(extension)) {
    return false;
  }

  const size = typeof file.sizeBytes === 'number' ? file.sizeBytes : 0;
  return size > 0 && size <= MAX_PREVIEW_FILE_SIZE_BYTES;
}

export function clampVolume(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function clampTime(value: number, duration: number): number {
  if (duration <= 0) {
    return 0;
  }
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(duration, Math.max(0, value));
}

export function getPreviewMimeType(filePath: string): string | undefined {
  const extension = getFileExtension(filePath);
  if (!extension) {
    return undefined;
  }
  return PREVIEW_MIME_TYPES[extension];
}
