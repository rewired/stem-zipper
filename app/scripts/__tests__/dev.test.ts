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

  it('normalises extended locale tags for newly added languages', () => {
    expect(normaliseLanguage('zh-CN')).toBe('zh');
    expect(normaliseLanguage('sv-SE')).toBe('sv');
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
    process.env.LC_ALL = 'ar_EG.UTF-8';
    process.env.LANG = 'he_IL';

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions() {
            return { locale: 'tr-TR' };
          }
        } as unknown as Intl.DateTimeFormat)
    );

    expect(normaliseLanguage()).toBe('en');
  });
});
