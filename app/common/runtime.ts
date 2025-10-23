import type { LocaleKey } from '@common/i18n';

export interface RuntimeConfig {
  locale: LocaleKey;
  devMode: boolean;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  locale: 'en',
  devMode: false
};
