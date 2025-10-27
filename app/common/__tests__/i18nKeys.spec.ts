import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES, translations } from '@common/i18n';

const REQUIRED_PACK_KEYS = [
  'pack_badge_no_zip_gain',
  'pack_badge_no_zip_gain_hint',
  'pack_badge_try_7z_volumes',
  'pack_badge_split_mono',
  'pack_aria_label_badge_split_mono',
  'pack_badge_estimate_prefix',
  'pack_badge_estimate_zip',
  'pack_badge_estimate_7z',
  'pack_action_split_zip',
  'pack_action_split_mono',
  'pack_table_col_select',
  'pack_table_col_estimate',
  'pack_table_select_all',
  'pack_tooltip_unselectable',
  'pack_row_reason_too_large_zip',
] as const;

describe('pack namespace translations', () => {
  it('includes badge and action labels for all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = translations[locale] as Record<string, string | undefined>;
      for (const key of REQUIRED_PACK_KEYS) {
        expect(catalog[key]).toBeDefined();
      }
    }
  });
});
