import { DEFAULT_MAX_SIZE_MB, MAX_SIZE_LIMIT_MB } from './constants';

export function ensureValidMaxSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_SIZE_MB;
  }
  if (value > MAX_SIZE_LIMIT_MB) {
    return MAX_SIZE_LIMIT_MB;
  }
  return value;
}
