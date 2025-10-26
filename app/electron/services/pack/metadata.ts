import type { LocaleKey } from '../../../common/i18n';
import { APP_VERSION } from '../../../common/version';
import {
  appendMetadataSection,
  createAttributionText,
  createLicenseText,
  createPackMetadataJson,
  type NormalizedPackMetadata
} from '../packMetadata';
import type { ExtraArchiveEntry } from './types';

export const STAMP_FILENAME = '_stem-zipper.txt';
const STEM_ZIPPER_LOGO = `░█▀▀░▀█▀░█▀▀░█▄█░░░▀▀█░▀█▀░█▀█░█▀█░█▀▀░█▀▄░
░▀▀█░░█░░█▀▀░█░█░░░▄▀░░░█░░█▀▀░█▀▀░█▀▀░█▀▄░
░▀▀▀░░▀░░▀▀▀░▀░▀░░░▀▀▀░▀▀▀░▀░░░▀░░░▀▀▀░▀░▀░`;
export const STEM_ZIPPER_STAMP = `${STEM_ZIPPER_LOGO}

Packed with Stem ZIPper v${APP_VERSION}

Get it here: https://github.com/rewired/stem-zipper
It's free and open source!`;

export function createMetadataEntries(
  metadata: NormalizedPackMetadata,
  locale: LocaleKey,
  packedAt: string
): { extras: ExtraArchiveEntry[]; stamp: string } {
  const extras: ExtraArchiveEntry[] = [
    { name: 'PACK-METADATA.json', content: createPackMetadataJson(metadata) },
    { name: 'LICENSE.txt', content: createLicenseText(metadata) },
    { name: 'ATTRIBUTION.txt', content: createAttributionText(metadata) }
  ];
  const stamp = appendMetadataSection(STEM_ZIPPER_STAMP, metadata, locale, packedAt);
  return { extras, stamp };
}
