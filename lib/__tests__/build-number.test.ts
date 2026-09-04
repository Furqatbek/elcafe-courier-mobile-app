// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  resolveBuildNumber,
  EPOCH_MS,
  MIN_PLAUSIBLE_BUILD_NUMBER,
  MAX_ANDROID_VERSION_CODE,
} = require('../../scripts/build-number.js');

const minutesAfterEpoch = (n: number) => EPOCH_MS + n * 60_000;

describe('resolveBuildNumber', () => {
  it('is the number of whole minutes since the epoch', () => {
    expect(resolveBuildNumber({ now: minutesAfterEpoch(1_500_000) })).toBe(1_500_000);
  });

  // The property the stores actually enforce: a code can never repeat and can
  // never go down. App Store Connect has already consumed ZBR Courier build 1
  // and Play versionCode 1, so anything derived must clear both by a wide
  // margin — which it does, since the epoch is well in the past.
  it('always increases with time, and never repeats', () => {
    const a = resolveBuildNumber({ now: minutesAfterEpoch(1_500_000) });
    const b = resolveBuildNumber({ now: minutesAfterEpoch(1_500_001) });
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(1);
  });

  // Expo evaluates app.config.ts several times per prebuild. Two evaluations
  // within the same minute must agree, or the value written to build.gradle
  // could differ from the one written to Info.plist.
  it('is stable within the same minute', () => {
    const start = minutesAfterEpoch(1_500_000);
    expect(resolveBuildNumber({ now: start })).toBe(
      resolveBuildNumber({ now: start + 59_999 })
    );
  });

  it('accepts an explicit override, to reproduce a specific build', () => {
    expect(resolveBuildNumber({ override: '1407604' })).toBe(1407604);
    expect(resolveBuildNumber({ override: '  1407604  ' })).toBe(1407604);
  });

  it('ignores an empty override rather than treating it as zero', () => {
    const now = minutesAfterEpoch(1_500_000);
    expect(resolveBuildNumber({ override: '', now })).toBe(1_500_000);
    expect(resolveBuildNumber({ override: '   ', now })).toBe(1_500_000);
  });

  it.each(['abc', '1.2.3', '-5', '1e6', '12 34'])(
    'rejects a malformed override (%s) instead of silently emitting NaN',
    (bad) => {
      expect(() => resolveBuildNumber({ override: bad })).toThrow(/positive integer/);
    }
  );

  it('rejects an out-of-range override', () => {
    expect(() => resolveBuildNumber({ override: '0' })).toThrow(/out of range/);
    expect(() =>
      resolveBuildNumber({ override: String(MAX_ANDROID_VERSION_CODE + 1) })
    ).toThrow(/out of range/);
  });

  // The one way a clock-derived number can go BACKWARDS is a wrong clock. That
  // would produce a code below one already uploaded, which the stores reject
  // after the build — so refuse before it.
  it('refuses to build when the system clock is implausibly early', () => {
    expect(() => resolveBuildNumber({ now: EPOCH_MS })).toThrow(/system clock/);
    expect(() =>
      resolveBuildNumber({ now: minutesAfterEpoch(MIN_PLAUSIBLE_BUILD_NUMBER - 1) })
    ).toThrow(/implausibly low/);
  });

  it('accepts the first plausible minute', () => {
    expect(
      resolveBuildNumber({ now: minutesAfterEpoch(MIN_PLAUSIBLE_BUILD_NUMBER) })
    ).toBe(MIN_PLAUSIBLE_BUILD_NUMBER);
  });

  it('stays inside the Android versionCode ceiling for the foreseeable future', () => {
    const inTwoHundredYears = minutesAfterEpoch(200 * 365 * 24 * 60);
    expect(resolveBuildNumber({ now: inTwoHundredYears })).toBeLessThan(
      MAX_ANDROID_VERSION_CODE
    );
  });

  it('refuses a number past the Android ceiling instead of emitting one Play rejects', () => {
    const farFuture = minutesAfterEpoch(MAX_ANDROID_VERSION_CODE + 1);
    expect(() => resolveBuildNumber({ now: farFuture })).toThrow(/maximum versionCode/);
  });
});
