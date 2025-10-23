import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreferencesForTests,
  addRecentArtist,
  getUserPreferences,
  setUserPreferences
} from '../preferences';
import type { UserPrefsAddRecent, UserPrefsSet } from '../../../common/ipc';

const PREFERENCES_FILE_NAME = 'stem-zipper-user-prefs.json';

const { appMock, setUserDataPath } = vi.hoisted(() => {
  let currentUserDataPath: string | null = null;

  return {
    appMock: {
      getPath: vi.fn((key: string) => {
        if (key !== 'userData') {
          throw new Error(`Unsupported path: ${key}`);
        }
        if (!currentUserDataPath) {
          throw new Error('userData path has not been initialised');
        }
        return currentUserDataPath;
      })
    },
    setUserDataPath(pathValue: string) {
      currentUserDataPath = pathValue;
    }
  };
});

vi.mock('electron', () => ({
  app: appMock
}));

let tempDir: string;

function preferencesFilePath(): string {
  return path.join(tempDir, PREFERENCES_FILE_NAME);
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stem-zipper-prefs-'));
  setUserDataPath(tempDir);
  appMock.getPath.mockClear();
  __resetPreferencesForTests();
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('preferences service', () => {
  it('reads preferences lazily and sanitises results', async () => {
    const emptyResult = await getUserPreferences();
    expect(emptyResult).toEqual({ default_artist: undefined, recent_artists: [] });

    await fs.writeFile(
      preferencesFilePath(),
      JSON.stringify(
        {
          default_artist: '  Beyoncé  ',
          recent_artists: ['  Beyoncé  ', '', 'Prince', '   ', '  prince  ', 'Extra']
        },
        null,
        2
      ),
      'utf8'
    );

    const populated = await getUserPreferences();
    expect(populated).toEqual({
      default_artist: 'Beyoncé',
      recent_artists: ['Beyoncé', 'Prince', 'Extra']
    });
  });

  it('updates the default artist while trimming invalid values', async () => {
    const request: UserPrefsSet = { default_artist: '  Prince  ' };
    await setUserPreferences(request);

    const stored = JSON.parse(await fs.readFile(preferencesFilePath(), 'utf8'));
    expect(stored).toEqual({ default_artist: 'Prince', recent_artists: [] });

    await setUserPreferences({ default_artist: '   ' });
    const cleared = JSON.parse(await fs.readFile(preferencesFilePath(), 'utf8'));
    expect(cleared).toEqual({ recent_artists: [] });
  });

  it('deduplicates and caps the recent artist list', async () => {
    await fs.writeFile(
      preferencesFilePath(),
      JSON.stringify(
        {
          default_artist: 'Existing',
          recent_artists: ['Existing', 'Other']
        },
        null,
        2
      ),
      'utf8'
    );

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

    const stored = JSON.parse(await fs.readFile(preferencesFilePath(), 'utf8'));
    expect(stored.recent_artists).toEqual(['Fifth', 'Fourth', 'Third', 'Another', 'New One']);
    expect(stored.default_artist).toBe('existing');
  });
});
