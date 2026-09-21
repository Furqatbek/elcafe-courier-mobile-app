/**
 * Semantic version comparison.
 *
 * Versions must never be compared as strings. `"1.10.0" < "1.9.0"` is true for
 * a string comparison — "1" sorts before "9" — so a courier on 1.10.0 would be
 * told to update to 1.9.0, and one on 2.0.0 would be told to update to 1.99.99.
 * Both of those are silent: no error, no crash, just a nag that never goes away
 * because the "newer" version can never be installed.
 *
 * Parsing is deliberately lenient about what surrounds the numbers, because the
 * inputs come from two places that are not under the same control: the store
 * version baked into the binary, and whatever the backend puts in its JSON.
 *
 * Everything from the first `-` or `+` is ignored (SemVer prerelease and build
 * metadata). `1.2.3-beta.1+exp.sha.5114f85` compares equal to `1.2.3`. That is
 * a deliberate simplification: this decides "should the courier be nagged to
 * update", and shipping a prerelease to the store is not a thing this project
 * does. Treating `1.2.3-beta` as OLDER than `1.2.3` — which strict SemVer
 * requires — would nag every tester on a beta build forever.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse `MAJOR.MINOR.PATCH`, tolerating missing trailing parts and surrounding
 * whitespace or a leading `v`. Returns null for anything unusable, so a caller
 * can tell "cannot compare" apart from "equal" — the difference matters: an
 * unparseable version must never be treated as up to date OR as out of date.
 */
export function parseVersion(input: unknown): ParsedVersion | null {
  if (typeof input === 'number') input = String(input);
  if (typeof input !== 'string') return null;

  // Drop prerelease/build metadata, a leading v, and surrounding space.
  const core = input.trim().replace(/^v/i, '').split(/[-+]/)[0];
  if (core === '') return null;

  const parts = core.split('.');
  if (parts.length > 3) return null;

  const nums: number[] = [];
  for (const part of parts) {
    // Reject "1.2.x", "1..2", "1.2.3abc" and negatives rather than coercing.
    // Number('') is 0 and parseInt('3abc') is 3 — both would invent a version.
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isSafeInteger(n)) return null;
    nums.push(n);
  }

  return { major: nums[0], minor: nums[1] ?? 0, patch: nums[2] ?? 0 };
}

/**
 * -1 when a < b, 0 when equal, 1 when a > b.
 * Returns null when either side cannot be parsed.
 */
export function compareVersions(a: unknown, b: unknown): -1 | 0 | 1 | null {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (va[key] < vb[key]) return -1;
    if (va[key] > vb[key]) return 1;
  }
  return 0;
}

/**
 * True only when `version` is definitely older than `other`.
 *
 * Unparseable input returns FALSE, not true: a courier must never be locked out
 * of a working app because the backend sent a malformed version string, or
 * because a future release numbering scheme is not understood by a build that
 * shipped before it existed. Failing open is the safe direction here — the
 * worst case is a missed update prompt, whereas failing closed is a blocking
 * dialog on an app that has nothing wrong with it.
 */
export function isOlderThan(version: unknown, other: unknown): boolean {
  return compareVersions(version, other) === -1;
}
