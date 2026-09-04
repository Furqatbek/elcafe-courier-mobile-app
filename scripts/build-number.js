/**
 * The build number, derived rather than stored.
 *
 * `android.versionCode` and `ios.buildNumber` must strictly increase and can
 * never be reused: Play rejects an AAB whose code has been seen before, and App
 * Store Connect rejects a build number already consumed — as it will for
 * ZBR Courier build 1, which App Review has already used.
 *
 * Keeping them as literals in app.config.ts made that a discipline problem, and
 * discipline lost repeatedly:
 *
 *   - `npm run prebuild` bumped them; `npx expo prebuild` (what every doc said
 *     to run) did not, so builds went out carrying a code already uploaded.
 *   - The bump edits a tracked file, so forgetting to commit it meant the next
 *     clone started over at 1.
 *   - Building for iOS also consumed an Android code and vice versa.
 *
 * Incrementing inside app.config.ts is not an option: Expo evaluates that file
 * several times per prebuild and again on every `expo start`, so a mutation
 * there would burn numbers just by opening the project. The value has to be
 * DERIVED — computed fresh each evaluation, identical within a single build,
 * and larger on the next one.
 *
 * Minutes elapsed since a fixed epoch does that with no stored state at all:
 *
 *   - monotonic by construction, so it cannot repeat or regress
 *   - needs no file to commit, so a fresh clone cannot reset it
 *   - needs no git, which matters because a shallow clone reports a commit
 *     count LOWER than the real one — the shallow clone this was written in
 *     reports 124 for a repository with more history than that. A build number
 *     derived from it would have gone backwards without a word.
 *   - a minute is longer than a build takes to start, so two builds of the same
 *     commit still get different numbers, which is exactly what two uploads need
 *
 * The cost is that a build number no longer identifies a commit. That job
 * belongs to the marketing `version` and a git tag, which stay explicit.
 */

// 2024-01-01T00:00:00Z. Never change this: every number ever uploaded is
// relative to it, and moving it would make new builds appear older.
const EPOCH_MS = Date.UTC(2024, 0, 1);

/**
 * Anything at or below this is treated as impossible and fails the build.
 *
 * The only realistic way to compute a number this low is a system clock set
 * before ~September 2026, which would otherwise silently emit a build number
 * below what has already been uploaded. Raise it only if you deliberately want
 * to invalidate older builds.
 */
const MIN_PLAUSIBLE_BUILD_NUMBER = 1_400_000;

/** Android's hard ceiling for versionCode. Reached in roughly 4000 years. */
const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

/**
 * @param {object} [options]
 * @param {string} [options.override] Value of ZBR_BUILD_NUMBER, to reproduce a
 *   specific build. Must be a positive integer.
 * @param {number} [options.now] Current time in ms; injectable for tests.
 * @returns {number}
 */
function resolveBuildNumber({ override, now = Date.now() } = {}) {
  if (override !== undefined && override !== null && String(override).trim() !== '') {
    const raw = String(override).trim();
    if (!/^\d+$/.test(raw)) {
      throw new Error(
        `ZBR_BUILD_NUMBER must be a positive integer, got "${raw}". ` +
          'It exists to reproduce one specific build; leave it unset to derive the number.'
      );
    }
    const parsed = Number(raw);
    if (parsed <= 0 || parsed > MAX_ANDROID_VERSION_CODE) {
      throw new Error(
        `ZBR_BUILD_NUMBER ${parsed} is out of range (1..${MAX_ANDROID_VERSION_CODE}).`
      );
    }
    return parsed;
  }

  const minutes = Math.floor((now - EPOCH_MS) / 60_000);

  if (minutes < MIN_PLAUSIBLE_BUILD_NUMBER) {
    throw new Error(
      `Derived build number ${minutes} is implausibly low (floor ${MIN_PLAUSIBLE_BUILD_NUMBER}).\n` +
        "This almost always means the system clock is wrong. Building with it would produce a " +
        'version code below one already uploaded, which the stores reject.\n' +
        'Fix the clock, or set ZBR_BUILD_NUMBER explicitly if you know what you are doing.'
    );
  }

  if (minutes > MAX_ANDROID_VERSION_CODE) {
    throw new Error(
      `Derived build number ${minutes} exceeds Android's maximum versionCode ` +
        `(${MAX_ANDROID_VERSION_CODE}).`
    );
  }

  return minutes;
}

module.exports = {
  resolveBuildNumber,
  EPOCH_MS,
  MIN_PLAUSIBLE_BUILD_NUMBER,
  MAX_ANDROID_VERSION_CODE,
};
