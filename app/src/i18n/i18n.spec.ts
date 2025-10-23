import en from '../../locales/en.json';
import de from '../../locales/de.json';

const enDict = en as Record<string, string>;
const deDict = de as Record<string, string>;

function extractPlaceholders(input: string): string[] {
  return Array.from(input.matchAll(/{{(\w+)}}/g)).map((match) => match[1]).sort();
}

describe('i18n lightweight policy', () => {
  it('no dot-notation in keys', () => {
    for (const key of Object.keys(enDict)) {
      expect(key).not.toMatch(/\./);
    }
    for (const key of Object.keys(deDict)) {
      expect(key).not.toMatch(/\./);
    }
  });

  it('de mirrors en keys 1:1', () => {
    const enKeys = Object.keys(enDict).sort();
    const deKeys = Object.keys(deDict).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it('placeholders match across languages', () => {
    for (const key of Object.keys(enDict)) {
      const enPlaceholders = extractPlaceholders(enDict[key]);
      const dePlaceholders = extractPlaceholders(deDict[key]);
      expect(dePlaceholders).toEqual(enPlaceholders);
    }
  });
});
