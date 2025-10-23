import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { UserPrefsAddRecent, UserPrefsSet } from '../../common/ipc';

const PREFERENCES_FILE_NAME = 'stem-zipper-user-prefs.json';
const MAX_RECENT_ARTISTS = 5;

interface StoredPreferences {
  default_artist?: string;
  recent_artists: string[];
}

type RawStoredPreferences = Partial<{
  default_artist: unknown;
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
  const sanitizedDefault =
    typeof input?.default_artist === 'string' ? sanitizeArtist(input.default_artist) : undefined;
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
  if (sanitizedDefault) {
    result.default_artist = sanitizedDefault;
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
  recent_artists: string[];
}> {
  await mutationQueue;
  const stored = await readStoredPreferencesFromDisk();
  return {
    default_artist: stored.default_artist,
    recent_artists: [...stored.recent_artists]
  };
}

export async function setUserPreferences(request: UserPrefsSet): Promise<void> {
  const sanitizedDefault = sanitizeArtist(request.default_artist);
  await queueMutation(async () => {
    const stored = await readStoredPreferencesFromDisk();
    const next: StoredPreferences = {
      recent_artists: stored.recent_artists
    };
    if (sanitizedDefault) {
      next.default_artist = sanitizedDefault;
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
    await writeStoredPreferencesToDisk(next);
  });
}

export function __resetPreferencesForTests(): void {
  preferencesFilePath = null;
  mutationQueue = Promise.resolve();
}
