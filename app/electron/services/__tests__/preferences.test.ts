import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronPreferencesStore } from '../electronStoreLoader';
import {
  addRecentArtist,
  getUserPreferences,
  setUserPreferences,
  __resetPreferencesForTests
} from '../preferences';
import type { UserPrefsAddRecent, UserPrefsSet } from '../../../common/ipc';

const { loadElectronStoreMock } = vi.hoisted(() => ({
  loadElectronStoreMock: vi.fn()
}));

vi.mock('../electronStoreLoader', () => ({
  loadElectronStore: loadElectronStoreMock
}));

interface StoredPreferences {
  default_artist?: string;
  recent_artists?: string[];
}

class FakeElectronStore implements ElectronPreferencesStore<StoredPreferences> {
  private data: Record<string, unknown>;

  constructor(options?: { defaults?: StoredPreferences; name?: string }) {
    this.data = { ...(options?.defaults ?? {}) };
    fakeStores.push(this);
  }

  public get<Key extends keyof StoredPreferences>(key: Key): StoredPreferences[Key];
  public get<Result = unknown>(key: string): Result;
  public get(key: string): unknown {
    return this.data[key];
  }

  public set<Key extends keyof StoredPreferences>(key: Key, value: StoredPreferences[Key]): void;
  public set(key: string, value: unknown): void;
  public set(key: string, value: unknown): void {
    this.data[key] = value;
  }

  public delete<Key extends keyof StoredPreferences>(key: Key): void;
  public delete(key: string): void;
  public delete(key: string): void {
    delete this.data[key];
  }
}

const fakeStores: FakeElectronStore[] = [];

function latestStore(): FakeElectronStore {
  const store = fakeStores.at(-1);
  if (!store) {
    throw new Error('Store was not initialised');
  }
  return store;
}

beforeEach(() => {
  fakeStores.length = 0;
  loadElectronStoreMock.mockReset();
  loadElectronStoreMock.mockResolvedValue(FakeElectronStore);
  __resetPreferencesForTests();
});

describe('preferences service', () => {
  it('creates the store lazily and sanitises results', async () => {
    const emptyResult = await getUserPreferences();
    expect(emptyResult).toEqual({ default_artist: undefined, recent_artists: [] });
    expect(loadElectronStoreMock).toHaveBeenCalledTimes(1);

    const store = latestStore();
    store.set('default_artist', '  Beyoncé  ');
    store.set('recent_artists', ['  Beyoncé  ', '', 'Prince', '   ', '  prince  ']);

    const populated = await getUserPreferences();
    expect(populated).toEqual({ default_artist: 'Beyoncé', recent_artists: ['Beyoncé', 'Prince', 'prince'] });
  });

  it('updates the default artist while trimming invalid values', async () => {
    await getUserPreferences();
    const store = latestStore();

    const request: UserPrefsSet = { default_artist: '  Prince  ' };
    await setUserPreferences(request);
    expect(store.get('default_artist')).toBe('Prince');

    await setUserPreferences({ default_artist: '   ' });
    expect(store.get('default_artist')).toBeUndefined();
  });

  it('deduplicates and caps the recent artist list', async () => {
    await getUserPreferences();
    const store = latestStore();
    store.set('recent_artists', ['Existing', 'Other']);
    store.set('default_artist', 'Existing');

    const requests: UserPrefsAddRecent[] = [
      { artist: '  ' },
      { artist: 'Existing' },
      { artist: ' existing  ' },
      { artist: 'New One' },
      { artist: 'Another' },
      { artist: 'Third' },
      { artist: 'Fourth' },
      { artist: 'Fifth' }
    ];

    for (const item of requests) {
      await addRecentArtist(item);
    }

    expect(store.get('recent_artists')).toEqual(['Fifth', 'Fourth', 'Third', 'Another', 'New One']);
    expect(store.get('default_artist')).toBe('existing');
  });
});
