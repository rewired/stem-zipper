import {
  EST_SPLIT_RATIO,
  EST_ZIP_OVERHEAD_BYTES,
  EST_STAMP_BYTES,
  EST_LICENSE_BYTES
} from './constants';
import type { EstimateRequest, EstimateResponse } from '../ipc';

export function estimateZipCount(req: EstimateRequest): EstimateResponse {
  const targetBytes = Math.max(1, Math.floor(req.targetMB * 1024 * 1024));
  const perZipOverhead = EST_ZIP_OVERHEAD_BYTES + EST_STAMP_BYTES + EST_LICENSE_BYTES;
  const bytesCapacity = Math.max(1, targetBytes - perZipOverhead);

  let bytesLogical = 0;
  for (const f of req.files) {
    const size = Math.max(0, f.sizeBytes | 0);
    const needsSplit = f.kind === 'wav' && f.stereo === true && size > targetBytes;
    const post = needsSplit ? Math.ceil(size * EST_SPLIT_RATIO) : size;
    bytesLogical += post;
  }
  const zips = Math.max(1, Math.ceil(bytesLogical / bytesCapacity));
  return {
    zips,
    bytesLogical,
    bytesCapacity,
    constants: {
      EST_SPLIT_RATIO,
      EST_ZIP_OVERHEAD_BYTES,
      EST_STAMP_BYTES,
      EST_LICENSE_BYTES,
      targetBytes,
      perZipOverhead
    }
  };
}
