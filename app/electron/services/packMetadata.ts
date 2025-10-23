import type { LicenseId, PackMetadata } from '../../common/ipc';
import { APP_VERSION } from '../../common/version';

export const CC_URL: Record<LicenseId, string> = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/'
};

const LICENSE_IDS = Object.keys(CC_URL) as LicenseId[];

function isLicenseId(value: unknown): value is LicenseId {
  return typeof value === 'string' && (LICENSE_IDS as readonly string[]).includes(value);
}

function cleanValue(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface NormalizedPackMetadata {
  title: string;
  artist: string;
  license: { id: LicenseId };
  album?: string;
  bpm?: string;
  key?: string;
  attribution?: string;
  links?: { artist_url?: string; contact_email?: string };
}

export function normalizePackMetadata(input: PackMetadata): NormalizedPackMetadata {
  const title = cleanValue(input.title);
  const artist = cleanValue(input.artist);
  const licenseId = input.license?.id;

  if (!title || !artist || !isLicenseId(licenseId)) {
    throw new Error('Missing pack metadata: title, artist and license are required.');
  }

  const normalized: NormalizedPackMetadata = {
    title,
    artist,
    license: { id: licenseId }
  };

  const album = cleanValue(input.album);
  if (album) {
    normalized.album = album;
  }

  const bpm = cleanValue(input.bpm);
  if (bpm) {
    normalized.bpm = bpm;
  }

  const key = cleanValue(input.key);
  if (key) {
    normalized.key = key;
  }

  const attribution = cleanValue(input.attribution);
  if (attribution) {
    normalized.attribution = attribution;
  }

  const artistUrl = cleanValue(input.links?.artist_url);
  const contactEmail = cleanValue(input.links?.contact_email);
  if (artistUrl || contactEmail) {
    normalized.links = {};
    if (artistUrl) {
      normalized.links.artist_url = artistUrl;
    }
    if (contactEmail) {
      normalized.links.contact_email = contactEmail;
    }
  }

  return normalized;
}

export function createPackMetadataJson(metadata: NormalizedPackMetadata): string {
  const payload: Record<string, unknown> = {
    title: metadata.title,
    artist: metadata.artist,
    license: { id: metadata.license.id }
  };

  if (metadata.album) {
    payload.album = metadata.album;
  }
  if (metadata.bpm) {
    payload.bpm = metadata.bpm;
  }
  if (metadata.key) {
    payload.key = metadata.key;
  }
  if (metadata.attribution) {
    payload.attribution = metadata.attribution;
  }
  if (metadata.links) {
    payload.links = { ...metadata.links };
  }

  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function createLicenseText(metadata: NormalizedPackMetadata): string {
  const url = CC_URL[metadata.license.id];
  return `License: ${metadata.license.id}\nURL: ${url}\n`;
}

export function createAttributionText(metadata: NormalizedPackMetadata): string {
  const fallback = `${metadata.artist} — ${metadata.title}`;
  return `${metadata.attribution ?? fallback}\n`;
}

export function appendMetadataSection(
  baseStamp: string,
  metadata: NormalizedPackMetadata,
  locale: string,
  packedAt: string
): string {
  const lines: string[] = ['[Metadata]'];
  lines.push(`Title: ${metadata.title}`);
  lines.push(`Artist: ${metadata.artist}`);
  if (metadata.album) {
    lines.push(`Album: ${metadata.album}`);
  }
  if (metadata.bpm) {
    lines.push(`BPM: ${metadata.bpm}`);
  }
  if (metadata.key) {
    lines.push(`Key: ${metadata.key}`);
  }
  lines.push(`License: ${metadata.license.id}`);
  lines.push(`Packed: ${packedAt}  App: ${APP_VERSION}  Locale: ${locale}`);

  return `${baseStamp}\n\n${lines.join('\n')}\n`;
}
