import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const devScript = require('../dev.cjs');

const { normaliseLanguage } = devScript;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('normaliseLanguage', () => {
  it('returns supported locales unchanged', () => {
    expect(normaliseLanguage('de')).toBe('de');
  });

  it('normalises extended locale tags to their primary language', () => {
    expect(normaliseLanguage('pt-BR')).toBe('pt');
  });

  it('falls back to the LC_ALL environment locale when no language is provided', () => {
    delete process.env.STEM_ZIPPER_LANG;
    process.env.LC_ALL = 'fr_FR.UTF-8';

    expect(normaliseLanguage()).toBe('fr');
  });

  it('resolves colon-delimited LANGUAGE preferences', () => {
    delete process.env.STEM_ZIPPER_LANG;
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    delete process.env.LANG;
    process.env.LANGUAGE = 'es:en';

    expect(normaliseLanguage()).toBe('es');
  });

  it('uses Intl resolved locale when environment variables are unavailable', () => {
    delete process.env.STEM_ZIPPER_LANG;
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
    delete process.env.LANG;
    delete process.env.LANGUAGE;

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions() {
            return { locale: 'it-IT' };
          }
        } as unknown as Intl.DateTimeFormat)
    );

    expect(normaliseLanguage()).toBe('it');
  });

  it('falls back to English when no supported locale can be detected', () => {
    delete process.env.STEM_ZIPPER_LANG;
    process.env.LC_ALL = 'zh_CN.UTF-8';
    process.env.LANG = 'ja_JP';

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions() {
            return { locale: 'ko-KR' };
          }
        } as unknown as Intl.DateTimeFormat)
    );

    expect(normaliseLanguage()).toBe('en');
  });
});
