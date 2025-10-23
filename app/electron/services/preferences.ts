import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { UserPrefsAddRecent, UserPrefsSet } from '../../common/ipc';

const PREFERENCES_FILE_NAME = 'stem-zipper-user-prefs.json';
const MAX_RECENT_ARTISTS = 5;

interface StoredPreferences {
  default_artist?: string;
  default_artist_url?: string;
  default_contact_email?: string;
  recent_artists: string[];
}

type RawStoredPreferences = Partial<{
  default_artist: unknown;
  default_artist_url: unknown;
  default_contact_email: unknown;
  recent_artists: unknown;
}>;

let preferencesFilePath: string | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function sanitizeArtist(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeArtistUrl(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value);
}

function sanitizeContactEmail(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return isValidEmail(trimmed) ? trimmed : undefined;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error) && typeof (error as NodeJS.ErrnoException).code === 'string';
}

function resolvePreferencesFilePath(): string {
  if (!preferencesFilePath) {
    const userDataPath = app.getPath('userData');
    preferencesFilePath = path.join(userDataPath, PREFERENCES_FILE_NAME);
  }
  return preferencesFilePath;
}

function normaliseStoredPreferences(input?: RawStoredPreferences | null): StoredPreferences {
  const sanitizedDefaultArtist =
    typeof input?.default_artist === 'string' ? sanitizeArtist(input.default_artist) : undefined;
  const sanitizedDefaultArtistUrl =
    typeof input?.default_artist_url === 'string'
      ? sanitizeArtistUrl(input.default_artist_url)
      : undefined;
  const sanitizedDefaultContactEmail =
    typeof input?.default_contact_email === 'string'
      ? sanitizeContactEmail(input.default_contact_email)
      : undefined;
  const seen = new Set<string>();
  const recentArtists: string[] = [];
  const rawRecent = Array.isArray(input?.recent_artists) ? input.recent_artists : [];
  for (const entry of rawRecent) {
    if (typeof entry !== 'string') {
      continue;
    }
    const sanitized = sanitizeArtist(entry);
    if (!sanitized) {
      continue;
    }
    const key = sanitized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    recentArtists.push(sanitized);
    if (recentArtists.length >= MAX_RECENT_ARTISTS) {
      break;
    }
  }
  const result: StoredPreferences = {
    recent_artists: recentArtists
  };
  if (sanitizedDefaultArtist) {
    result.default_artist = sanitizedDefaultArtist;
  }
  if (sanitizedDefaultArtistUrl) {
    result.default_artist_url = sanitizedDefaultArtistUrl;
  }
  if (sanitizedDefaultContactEmail) {
    result.default_contact_email = sanitizedDefaultContactEmail;
  }
  return result;
}

async function readStoredPreferencesFromDisk(): Promise<StoredPreferences> {
  const filePath = resolvePreferencesFilePath();
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    if (!contents.trim()) {
      return normaliseStoredPreferences();
    }
    const parsed = JSON.parse(contents) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return normaliseStoredPreferences();
    }
    return normaliseStoredPreferences(parsed as RawStoredPreferences);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return normaliseStoredPreferences();
    }
    if (error instanceof SyntaxError) {
      console.warn(
        `[preferences] Failed to parse stored preferences JSON (${error.message}); resetting to defaults.`
      );
      return normaliseStoredPreferences();
    }
    throw error;
  }
}

async function writeStoredPreferencesToDisk(preferences: StoredPreferences): Promise<void> {
  const filePath = resolvePreferencesFilePath();
  const payload = normaliseStoredPreferences(preferences);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function queueMutation(task: () => Promise<void>): Promise<void> {
  const run = mutationQueue.then(task, task);
  mutationQueue = run.catch(() => {});
  return run;
}

export async function getUserPreferences(): Promise<{
  default_artist?: string;
  default_artist_url?: string;
  default_contact_email?: string;
  recent_artists: string[];
}> {
  await mutationQueue;
  const stored = await readStoredPreferencesFromDisk();
  return {
    default_artist: stored.default_artist,
    default_artist_url: stored.default_artist_url,
    default_contact_email: stored.default_contact_email,
    recent_artists: [...stored.recent_artists]
  };
}

export async function setUserPreferences(request: UserPrefsSet): Promise<void> {
  const sanitizedDefaultArtist = sanitizeArtist(request.default_artist);
  const sanitizedDefaultArtistUrl = sanitizeArtistUrl(request.default_artist_url);
  const sanitizedDefaultContactEmail = sanitizeContactEmail(request.default_contact_email);
  await queueMutation(async () => {
    const stored = await readStoredPreferencesFromDisk();
    const next: StoredPreferences = {
      recent_artists: stored.recent_artists
    };
    if ('default_artist' in request) {
      if (sanitizedDefaultArtist) {
        next.default_artist = sanitizedDefaultArtist;
      }
    } else if (stored.default_artist) {
      next.default_artist = stored.default_artist;
    }
    if ('default_artist_url' in request) {
      if (sanitizedDefaultArtistUrl) {
        next.default_artist_url = sanitizedDefaultArtistUrl;
      }
    } else if (stored.default_artist_url) {
      next.default_artist_url = stored.default_artist_url;
    }
    if ('default_contact_email' in request) {
      if (sanitizedDefaultContactEmail) {
        next.default_contact_email = sanitizedDefaultContactEmail;
      }
    } else if (stored.default_contact_email) {
      next.default_contact_email = stored.default_contact_email;
    }
    await writeStoredPreferencesToDisk(next);
  });
}

export async function addRecentArtist(request: UserPrefsAddRecent): Promise<void> {
  const sanitized = sanitizeArtist(request.artist);
  if (!sanitized) {
    return;
  }
  const lowered = sanitized.toLowerCase();
  await queueMutation(async () => {
    const stored = await readStoredPreferencesFromDisk();
    const deduped = [
      sanitized,
      ...stored.recent_artists.filter((item) => item.toLowerCase() !== lowered)
    ];
    const trimmed = deduped.slice(0, MAX_RECENT_ARTISTS);
    const next: StoredPreferences = {
      recent_artists: trimmed
    };
    const currentDefault = stored.default_artist;
    if (currentDefault) {
      next.default_artist = currentDefault.toLowerCase() === lowered ? sanitized : currentDefault;
    }
    if (stored.default_artist_url) {
      next.default_artist_url = stored.default_artist_url;
    }
    if (stored.default_contact_email) {
      next.default_contact_email = stored.default_contact_email;
    }
    await writeStoredPreferencesToDisk(next);
  });
}

export function __resetPreferencesForTests(): void {
  preferencesFilePath = null;
  mutationQueue = Promise.resolve();
}
