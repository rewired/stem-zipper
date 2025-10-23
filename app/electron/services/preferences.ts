import Store from 'electron-store';
import type { UserPrefsAddRecent, UserPrefsSet } from '../../common/ipc';

interface StoredPreferences {
  default_artist?: string;
  recent_artists?: string[];
}

const store = new Store<StoredPreferences>({
  name: 'stem-zipper-user-prefs',
  defaults: {
    recent_artists: []
  }
});

function sanitizeArtist(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getUserPreferences(): { default_artist?: string; recent_artists: string[] } {
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

export function setUserPreferences(request: UserPrefsSet): void {
  const sanitizedDefault = sanitizeArtist(request.default_artist);
  if (sanitizedDefault) {
    store.set('default_artist', sanitizedDefault);
  } else {
    store.delete('default_artist');
  }
}

export function addRecentArtist(request: UserPrefsAddRecent): void {
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
