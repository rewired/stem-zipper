import { describe, expect, it } from 'vitest';
import { isPreviewable, MAX_PREVIEW_FILE_SIZE_BYTES } from '../previewUtils';

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
