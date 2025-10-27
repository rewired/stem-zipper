import { describe, expect, it } from 'vitest';
import { getPreviewMimeType, isPreviewable, MAX_PREVIEW_FILE_SIZE_BYTES } from '../previewUtils';

describe('isPreviewable', () => {
  it('allows supported extensions within the size limit', () => {
    const result = isPreviewable({ path: '/tmp/track.wav', sizeBytes: MAX_PREVIEW_FILE_SIZE_BYTES });
    expect(result).toBe(true);
  });

  it('rejects unsupported extensions', () => {
    const result = isPreviewable({ path: '/tmp/video.mp4', sizeBytes: 1024 });
    expect(result).toBe(false);
  });

  it('rejects files exceeding the size limit', () => {
    const result = isPreviewable({
      path: '/tmp/over.flac',
      sizeBytes: MAX_PREVIEW_FILE_SIZE_BYTES + 1
    });
    expect(result).toBe(false);
  });
});

describe('getPreviewMimeType', () => {
  it('returns the expected mime type for supported previews', () => {
    expect(getPreviewMimeType('/tmp/sample.wav')).toBe('audio/wav');
    expect(getPreviewMimeType('/tmp/sample.flac')).toBe('audio/flac');
    expect(getPreviewMimeType('/tmp/sample.mp3')).toBe('audio/mpeg');
  });

  it('returns undefined for unsupported extensions', () => {
    expect(getPreviewMimeType('/tmp/sample.weird')).toBeUndefined();
    expect(getPreviewMimeType('/tmp/sample')).toBeUndefined();
  });
});
