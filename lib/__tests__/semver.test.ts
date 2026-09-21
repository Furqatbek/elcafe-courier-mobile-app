import { parseVersion, compareVersions, isOlderThan } from '@/lib/semver';

describe('parseVersion', () => {
  it('parses the normal shapes', () => {
    expect(parseVersion('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('1.10.0')).toEqual({ major: 1, minor: 10, patch: 0 });
    expect(parseVersion('2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
  });

  it('fills in missing trailing parts', () => {
    expect(parseVersion('2')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parseVersion('2.1')).toEqual({ major: 2, minor: 1, patch: 0 });
  });

  it('ignores prerelease and build metadata', () => {
    expect(parseVersion('1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('1.2.3+exp.sha.5114f85')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('1.2.3-rc.1+build.9')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('tolerates a leading v and surrounding space', () => {
    expect(parseVersion('  v1.2.3 ')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  // Coercion here invents versions: Number('') is 0, parseInt('3abc') is 3.
  // Either would silently produce a comparison against a version nobody shipped.
  it.each(['', '   ', 'abc', '1.2.x', '1..2', '1.2.3.4', '-1.0.0', '1.2.3abc', null, undefined, {}, []])(
    'returns null for unusable input (%p)',
    (bad) => {
      expect(parseVersion(bad as any)).toBeNull();
    }
  );
});

describe('compareVersions', () => {
  // The two cases the string comparison gets wrong, which is the whole reason
  // this module exists: "1.10.0" < "1.9.0" and "2.0.0" < "1.99.99" as strings.
  it('orders by numeric component, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.99.99', '2.0.0')).toBe(-1);
  });

  it('is a sanity check against plain string comparison', () => {
    // Both of these string comparisons are WRONG; the module must disagree.
    expect('1.10.0' < '1.9.0').toBe(true);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect('2.0.0' < '1.99.99').toBe(false);
  });

  it('reports equality, including across metadata', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });

  it('walks major, then minor, then patch', () => {
    expect(compareVersions('2.0.0', '1.999.999')).toBe(1);
    expect(compareVersions('1.3.0', '1.2.999')).toBe(1);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
  });

  it('returns null when either side is unparseable', () => {
    expect(compareVersions('1.0.0', 'garbage')).toBeNull();
    expect(compareVersions('garbage', '1.0.0')).toBeNull();
    expect(compareVersions(undefined, '1.0.0')).toBeNull();
  });
});

describe('isOlderThan', () => {
  it('is true only for a strictly older version', () => {
    expect(isOlderThan('1.0.0', '1.0.1')).toBe(true);
    expect(isOlderThan('1.9.0', '1.10.0')).toBe(true);
    expect(isOlderThan('1.0.0', '1.0.0')).toBe(false);
    expect(isOlderThan('1.0.1', '1.0.0')).toBe(false);
  });

  // Fails OPEN. A malformed version from the backend, or a numbering scheme a
  // shipped build does not understand, must never lock a courier out of an app
  // that works. A missed prompt is recoverable; a blocking dialog on a healthy
  // app is not, because the user cannot get past it to do anything about it.
  it('is false when the comparison is impossible', () => {
    expect(isOlderThan('1.0.0', undefined)).toBe(false);
    expect(isOlderThan('1.0.0', '')).toBe(false);
    expect(isOlderThan('1.0.0', 'latest')).toBe(false);
    expect(isOlderThan(undefined, '9.9.9')).toBe(false);
    expect(isOlderThan(null, null)).toBe(false);
  });
});
