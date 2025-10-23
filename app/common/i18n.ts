import cs from '../locales/cs.json';
import da from '../locales/da.json';
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fi from '../locales/fi.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import nl from '../locales/nl.json';
import no from '../locales/no.json';
import pl from '../locales/pl.json';
import pt from '../locales/pt.json';
import ro from '../locales/ro.json';
import sv from '../locales/sv.json';
import th from '../locales/th.json';
import uk from '../locales/uk.json';
import zh from '../locales/zh.json';

type Catalog = typeof en;

type TranslationMap = Record<string, Catalog>;

const catalogData = {
  cs,
  da,
  de,
  en,
  es,
  fi,
  fr,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  pt,
  ro,
  sv,
  th,
  uk,
  zh
} as const satisfies TranslationMap;

export const translations = catalogData;

export type LocaleKey = keyof typeof translations;

export const SUPPORTED_LOCALES = Object.keys(translations) as LocaleKey[];

export const DEFAULT_LOCALE: LocaleKey = 'en';

export type TranslationCatalog = (typeof translations)[LocaleKey];

export type TranslationKey = keyof (typeof translations)['en'];

export type TranslationParams = Record<string, string | number>;

const PLACEHOLDER_PATTERN = /{{(\w+)}}/g;

function formatTemplate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(PLACEHOLDER_PATTERN, (_match, param: string) => {
    if (Object.prototype.hasOwnProperty.call(params, param)) {
      return String(params[param]);
    }
    return '';
  });
}

function getCatalog(locale: LocaleKey): TranslationCatalog {
  return translations[locale];
}

export function formatMessage(
  locale: LocaleKey,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const catalog = getCatalog(locale) as Record<string, string>;
  const fallback = getCatalog(DEFAULT_LOCALE) as Record<string, string>;
  const normalizedKey = key as string;
  const template = catalog[normalizedKey] ?? fallback[normalizedKey] ?? normalizedKey;
  return formatTemplate(template, params);
}

function matchLocale(locale: string | null | undefined): LocaleKey | undefined {
  if (!locale) {
    return undefined;
  }
  const normalized = locale.toLowerCase();
  if (normalized in translations) {
    return normalized as LocaleKey;
  }
  const short = normalized.slice(0, 2);
  if (short in translations) {
    return short as LocaleKey;
  }
  return undefined;
}

export function resolveLocale(
  ...candidates: Array<string | null | undefined | readonly string[]>
): LocaleKey {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (typeof candidate === 'string') {
      const match = matchLocale(candidate);
      if (match) {
        return match;
      }
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const match = matchLocale(entry);
        if (match) {
          return match;
        }
      }
    }
  }
  return DEFAULT_LOCALE;
}

export function tNS(
  namespace: string,
  key: string,
  params?: TranslationParams,
  locale: LocaleKey = DEFAULT_LOCALE
): string {
  const fullKey = `${namespace}_${key}` as TranslationKey;
  return formatMessage(locale, fullKey, params);
}

export function t(
  legacy: string,
  params?: TranslationParams,
  locale: LocaleKey = DEFAULT_LOCALE
): string {
  const [namespace, rest] = legacy.split('.', 2);
  if (!rest) {
    return formatMessage(locale, namespace as TranslationKey, params);
  }
  return tNS(namespace, rest, params, locale);
}
