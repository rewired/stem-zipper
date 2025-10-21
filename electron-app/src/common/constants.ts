export const VERSION = '0.9.0';

export const DEFAULT_MAX_SIZE_MB = 48;
export const MAX_SIZE_LIMIT_MB = 500;

export const SUPPORTED_EXTENSIONS = [
  '.wav',
  '.flac',
  '.mp3',
  '.aiff',
  '.ogg',
  '.aac',
  '.wma'
];

export const STAMP_FILENAME = '_stem-zipper.txt';
export const STEM_ZIPPER_LOGO = `░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ v${VERSION} ░`;

export const STEM_ZIPPER_STAMP = `${STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v${VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!`;

export const LANGUAGE_CODES = ['en', 'de', 'fr', 'it', 'es', 'pt'] as const;
