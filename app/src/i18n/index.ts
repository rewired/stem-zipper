import en from '../../locales/en.json';
import de from '../../locales/de.json';

type Dict = Record<string, string>;
const catalogs: Record<string, Dict> = {
  en,
  de
};

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = Object.keys(catalogs);

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/{{(\w+)}}/g, (_, p) => String(params[p] ?? ''));
}

/**
 * Lightweight i18n:
 * - namespace is a string ("pack", "app", ...)
 * - key is underscore-case ("toast_estimate")
 * - full key becomes "<namespace>_<key>"
 */
export function tNS(
  namespace: string,
  key: string,
  params?: Record<string, string | number>,
  lang: string = DEFAULT_LOCALE
): string {
  const full = `${namespace}_${key}`;
  const dict = (catalogs[lang] ?? catalogs[DEFAULT_LOCALE]) as Dict;
  const fallbackDict = catalogs[DEFAULT_LOCALE] as Dict;

  const template =
    dict[full] ??
    fallbackDict[full] ??
    full; // debug fallback: show missing key
  return format(template, params);
}

/**
 * Deprecated shim for legacy calls like t('pack.toast_estimate')
 */
export function t(legacy: string, params?: Record<string, string | number>, lang: string = DEFAULT_LOCALE): string {
  const [ns, rest] = legacy.split('.', 2);
  return tNS(ns ?? 'app', rest ?? legacy, params, lang);
}
