import type { UserPrefsAddRecent, UserPrefsSet } from '../../common/ipc';
import { loadElectronStore } from './electronStoreLoader';
import type { ElectronPreferencesStore } from './electronStoreLoader';

interface StoredPreferences {
  default_artist?: string;
  recent_artists?: string[];
}

type PreferencesStore = ElectronPreferencesStore<StoredPreferences>;

let storePromise: Promise<PreferencesStore> | null = null;

async function getStore(): Promise<PreferencesStore> {
  if (!storePromise) {
    storePromise = loadElectronStore().then(
      (ElectronStore) =>
        new ElectronStore<StoredPreferences>({
          name: 'stem-zipper-user-prefs',
          defaults: {
            recent_artists: []
          }
        })
    );
  }
  return storePromise;
}

function sanitizeArtist(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function getUserPreferences(): Promise<{ default_artist?: string; recent_artists: string[] }> {
  const store = await getStore();
  const defaultArtist = sanitizeArtist(store.get('default_artist'));
  const recentArtistsRaw = store.get('recent_artists') ?? [];
  const recentArtists = recentArtistsRaw
    .map((artist) => sanitizeArtist(artist))
    .filter((artist): artist is string => Boolean(artist));
  return {
    default_artist: defaultArtist,
    recent_artists: recentArtists
  };
}

export async function setUserPreferences(request: UserPrefsSet): Promise<void> {
  const store = await getStore();
  const sanitizedDefault = sanitizeArtist(request.default_artist);
  if (sanitizedDefault) {
    store.set('default_artist', sanitizedDefault);
  } else {
    store.delete('default_artist');
  }
}

export async function addRecentArtist(request: UserPrefsAddRecent): Promise<void> {
  const store = await getStore();
  const sanitized = sanitizeArtist(request.artist);
  if (!sanitized) {
    return;
  }
  const existing = store.get('recent_artists') ?? [];
  const deduped = [sanitized, ...existing.filter((item) => item.trim().toLowerCase() !== sanitized.toLowerCase())];
  store.set('recent_artists', deduped.slice(0, 5));
  const currentDefault = sanitizeArtist(store.get('default_artist'));
  if (!currentDefault) {
    return;
  }
  if (currentDefault.toLowerCase() === sanitized.toLowerCase()) {
    store.set('default_artist', sanitized);
  }
}

export function __resetPreferencesForTests(): void {
  storePromise = null;
}
