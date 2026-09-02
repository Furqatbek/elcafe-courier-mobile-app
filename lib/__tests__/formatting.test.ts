import {
  formatCurrency,
  courierEarnings,
  hasTip,
  formatDistance,
  formatDuration,
  parseServerDate,
} from '@/lib/formatting';

// formatCurrency groups thousands with a non-breaking space (U+00A0) so
// amounts never wrap mid-number in the UI.
const NBSP = '\u00A0';

describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe("0 so'm");
  });

  it('formats null and undefined as zero', () => {
    expect(formatCurrency(null)).toBe("0 so'm");
    expect(formatCurrency(undefined)).toBe("0 so'm");
  });

  it('formats NaN as zero', () => {
    expect(formatCurrency(NaN)).toBe("0 so'm");
  });

  it('formats small values without grouping', () => {
    expect(formatCurrency(999)).toBe("999 so'm");
  });

  it('groups thousands with non-breaking spaces', () => {
    expect(formatCurrency(1000)).toBe(`1${NBSP}000 so'm`);
    expect(formatCurrency(25500)).toBe(`25${NBSP}500 so'm`);
  });

  it('formats large values', () => {
    expect(formatCurrency(1234567890)).toBe(`1${NBSP}234${NBSP}567${NBSP}890 so'm`);
  });

  it('rounds fractional amounts to whole som', () => {
    expect(formatCurrency(1000.4)).toBe(`1${NBSP}000 so'm`);
    expect(formatCurrency(999.5)).toBe(`1${NBSP}000 so'm`);
  });

  it('keeps the minus sign in front of grouped digits', () => {
    expect(formatCurrency(-15000)).toBe(`-15${NBSP}000 so'm`);
  });

  it('is deterministic regardless of device locale (no comma grouping)', () => {
    expect(formatCurrency(1000000)).not.toContain(',');
  });
});

describe('courierEarnings', () => {
  it('sums delivery fee and tip', () => {
    expect(courierEarnings({ deliveryFee: 12000, tipAmount: 3000 })).toBe(15000);
  });

  it('treats missing tip as zero', () => {
    expect(courierEarnings({ deliveryFee: 12000 })).toBe(12000);
    expect(courierEarnings({ deliveryFee: 12000, tipAmount: null })).toBe(12000);
  });

  it('treats missing fee as zero', () => {
    expect(courierEarnings({ tipAmount: 500 })).toBe(500);
    expect(courierEarnings({})).toBe(0);
  });

  it('never returns the order total field (courier pay only)', () => {
    const order = { deliveryFee: 10000, tipAmount: 2000, total: 99000 };
    expect(courierEarnings(order)).toBe(12000);
  });
});

describe('hasTip (zero-tip conditional render guard)', () => {
  it('is false for a zero tip', () => {
    expect(hasTip({ tipAmount: 0 })).toBe(false);
  });

  it('is false for missing/null tip', () => {
    expect(hasTip({})).toBe(false);
    expect(hasTip({ tipAmount: null })).toBe(false);
    expect(hasTip({ tipAmount: undefined })).toBe(false);
  });

  it('is true for a positive tip', () => {
    expect(hasTip({ tipAmount: 1 })).toBe(true);
    expect(hasTip({ tipAmount: 5000 })).toBe(true);
  });

  it('returns a boolean, never a leaky 0 for JSX short-circuits', () => {
    // {order.tipAmount && <View/>} renders a literal "0" in React Native and
    // crashes with "Text strings must be rendered within a <Text>".
    expect(typeof hasTip({ tipAmount: 0 })).toBe('boolean');
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(650)).toBe('650 m');
  });

  it('formats kilometers with one decimal', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45 sec');
  });

  it('formats minutes', () => {
    expect(formatDuration(300)).toBe('5 min');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatDuration(3900)).toBe('1 hr 5 min');
  });

  it('formats whole hours without minutes', () => {
    expect(formatDuration(7200)).toBe('2 hr');
  });
});

describe('parseServerDate', () => {
  it('parses the real backend format (trailing Z, second precision)', () => {
    // JacksonConfig pins yyyy-MM-dd'T'HH:mm:ss'Z'. Milliseconds are truncated,
    // not rounded — which is why nothing in the app sorts by these values.
    const parsed = parseServerDate('2026-09-01T13:06:32Z');
    expect(parsed.toISOString()).toBe('2026-09-01T13:06:32.000Z');
  });

  it('treats a suffix-less timestamp as UTC, not local time', () => {
    // Defensive fallback only — the live format carries a Z. If the serializer
    // ever regressed to a naive string, raw `new Date()` would read it as local
    // time and, in Tashkent (UTC+5), place every order 5 hours in the past.
    const parsed = parseServerDate('2026-08-31T09:42:19.821');
    expect(parsed.toISOString()).toBe('2026-08-31T09:42:19.821Z');
  });

  it('does not double-append when the timestamp already carries Z', () => {
    const parsed = parseServerDate('2026-08-31T09:42:19.821Z');
    expect(parsed.toISOString()).toBe('2026-08-31T09:42:19.821Z');
  });

  it('respects an explicit numeric offset', () => {
    // 14:42 at +05:00 is 09:42 UTC
    expect(parseServerDate('2026-08-31T14:42:19+05:00').toISOString())
      .toBe('2026-08-31T09:42:19.000Z');
  });

  it('passes a Date through untouched', () => {
    const d = new Date('2026-08-31T09:42:19.821Z');
    expect(parseServerDate(d)).toBe(d);
  });
});
