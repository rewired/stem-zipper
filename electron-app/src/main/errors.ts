export class StemZipperError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = code;
  }
}

export const ErrorCodes = {
  NoSupportedFiles: 'NO_SUPPORTED_FILES',
  InvalidPath: 'INVALID_PATH'
} as const;
