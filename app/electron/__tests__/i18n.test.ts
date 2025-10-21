import { describe, expect, it } from 'vitest';

import { resolveLocale } from '@common/i18n';

describe('resolveLocale', () => {
  it('prefers the system locale over English preferred languages', () => {
    const locale = resolveLocale(
      undefined,
      undefined,
      undefined,
      'de-DE',
      ['en-US', 'en']
    );

    expect(locale).toBe('de');
  });
});
