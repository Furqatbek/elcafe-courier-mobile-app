import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import uz from '@/i18n/locales/uz.json';

/**
 * Full recursive key-set parity across all locales.
 *
 * Every dot-path leaf key present in ANY locale must exist in EVERY locale,
 * and every leaf value must be a non-empty string. This is deliberately
 * strict (set equality in both directions), so a key added to en.json
 * without ru/uz translations — or a stray key left behind in ru/uz — fails
 * CI instead of silently rendering the English defaultValue (or the raw key)
 * to Russian/Uzbek couriers.
 *
 * The ONE sanctioned asymmetry is i18next plural suffixes: each language
 * needs exactly the CLDR cardinal categories of that language (Russian has
 * one/few/many/other; English and Uzbek have one/other), so plural variants
 * are compared as their BASE key, and a separate per-locale check asserts
 * the full category set for every pluralized key.
 */

const LOCALES: Record<string, Record<string, unknown>> = { en, ru, uz };

// CLDR cardinal plural categories used by i18next (Intl.PluralRules).
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
const PLURAL_SUFFIX_RE = new RegExp(`_(${PLURAL_CATEGORIES.join('|')})$`);

// Categories i18next resolves for integer counts in each supported language.
const REQUIRED_CATEGORIES: Record<string, string[]> = {
  en: ['one', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  uz: ['one', 'other'],
};

/** Flatten a locale object into sorted "a.b.c" leaf paths. */
function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectLeafPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

/** Collect leaf paths whose value is not a non-empty string. */
function collectBadValues(obj: Record<string, unknown>, prefix = ''): string[] {
  const bad: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      bad.push(...collectBadValues(value as Record<string, unknown>, path));
    } else if (typeof value !== 'string' || value.trim() === '') {
      bad.push(path);
    }
  }
  return bad;
}

const localeNames = Object.keys(LOCALES);
const leafPathsByLocale = Object.fromEntries(
  localeNames.map((name) => [name, collectLeafPaths(LOCALES[name])])
) as Record<string, string[]>;

// A key is a plural family only when some locale defines BOTH `${base}_one`
// and `${base}_other` — the minimal i18next pair for en/ru/uz. A lone
// `_other`-suffixed name (e.g. order_detail.issue_other, the "Other" issue
// type) is a literal key and must NOT be plural-normalized.
const pluralBaseSet = new Set<string>();
for (const name of localeNames) {
  const leafSet = new Set(leafPathsByLocale[name]);
  for (const path of leafPathsByLocale[name]) {
    const match = path.match(PLURAL_SUFFIX_RE);
    if (!match) continue;
    const base = path.slice(0, -match[0].length);
    if (leafSet.has(`${base}_one`) && leafSet.has(`${base}_other`)) {
      pluralBaseSet.add(base);
    }
  }
}

/** "orders.minutes_ago_few" -> "orders.minutes_ago"; literal keys pass through. */
const toBasePath = (path: string): string => {
  const match = path.match(PLURAL_SUFFIX_RE);
  if (!match) return path;
  const base = path.slice(0, -match[0].length);
  return pluralBaseSet.has(base) ? base : path;
};

const basePathsByLocale = Object.fromEntries(
  localeNames.map((name) => [
    name,
    [...new Set(leafPathsByLocale[name].map(toBasePath))].sort(),
  ])
) as Record<string, string[]>;

describe('locale key parity (en/ru/uz)', () => {
  it('has at least one key per locale (sanity check that flattening works)', () => {
    for (const name of localeNames) {
      expect(leafPathsByLocale[name].length).toBeGreaterThan(0);
    }
  });

  // Pairwise set-difference in both directions gives actionable failure
  // messages: the assertion prints exactly which keys are missing where.
  describe.each(localeNames.filter((n) => n !== 'en'))('en <-> %s', (other) => {
    it(`every en key exists in ${other}`, () => {
      const otherSet = new Set(basePathsByLocale[other]);
      const missing = basePathsByLocale.en.filter((p) => !otherSet.has(p));
      expect(missing).toEqual([]);
    });

    it(`every ${other} key exists in en`, () => {
      const enSet = new Set(basePathsByLocale.en);
      const extra = basePathsByLocale[other].filter((p) => !enSet.has(p));
      expect(extra).toEqual([]);
    });
  });

  describe.each(localeNames)('%s', (name) => {
    it('every leaf value is a non-empty string', () => {
      expect(collectBadValues(LOCALES[name])).toEqual([]);
    });

    it("every pluralized key defines all of the language's CLDR categories", () => {
      const leafSet = new Set(leafPathsByLocale[name]);
      const missing = [...pluralBaseSet].sort().flatMap((base) =>
        REQUIRED_CATEGORIES[name]
          .map((cat) => `${base}_${cat}`)
          .filter((full) => !leafSet.has(full))
      );
      expect(missing).toEqual([]);
    });
  });
});
