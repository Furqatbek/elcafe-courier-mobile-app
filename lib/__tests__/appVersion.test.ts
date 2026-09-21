import {
  evaluateUpdate,
  isStoreUrlForThisPlatform,
  resolveStoreUrl,
} from '@/services/appVersion';
import { STORE_URLS } from '@/constants/config';

describe('isStoreUrlForThisPlatform', () => {
  it('accepts Apple links on iOS', () => {
    expect(isStoreUrlForThisPlatform('https://apps.apple.com/app/id6807758268', 'ios')).toBe(true);
    expect(isStoreUrlForThisPlatform('https://itunes.apple.com/app/id123', 'ios')).toBe(true);
    expect(isStoreUrlForThisPlatform('itms-apps://apps.apple.com/app/id123', 'ios')).toBe(true);
  });

  it('accepts Play links on Android', () => {
    expect(
      isStoreUrlForThisPlatform('https://play.google.com/store/apps/details?id=app.zbr.courier', 'android')
    ).toBe(true);
    expect(isStoreUrlForThisPlatform('market://details?id=app.zbr.courier', 'android')).toBe(true);
  });

  // The failure this prevents is silent: the button "works", a web page loads,
  // and nothing installs. Half the fleet would be stranded with no error.
  it('rejects the other platform’s store', () => {
    expect(
      isStoreUrlForThisPlatform('https://play.google.com/store/apps/details?id=x', 'ios')
    ).toBe(false);
    expect(isStoreUrlForThisPlatform('https://apps.apple.com/app/id123', 'android')).toBe(false);
  });

  it.each([null, undefined, '', '   ', 42, {}, 'https://example.com/download', 'javascript:alert(1)'])(
    'rejects junk (%p)',
    (bad) => {
      expect(isStoreUrlForThisPlatform(bad as any, 'ios')).toBe(false);
      expect(isStoreUrlForThisPlatform(bad as any, 'android')).toBe(false);
    }
  );
});

describe('resolveStoreUrl', () => {
  it('prefers a backend URL that matches the platform', () => {
    const url = 'https://apps.apple.com/app/id999';
    expect(resolveStoreUrl(url, 'ios')).toBe(url);
  });

  it('falls back to the configured URL when the backend sends the wrong platform', () => {
    expect(resolveStoreUrl('https://play.google.com/store/apps/details?id=x', 'ios')).toBe(
      STORE_URLS.IOS
    );
    expect(resolveStoreUrl('https://apps.apple.com/app/id1', 'android')).toBe(STORE_URLS.ANDROID);
  });

  it('falls back when the backend sends nothing', () => {
    expect(resolveStoreUrl(undefined, 'ios')).toBe(STORE_URLS.IOS);
    expect(resolveStoreUrl(undefined, 'android')).toBe(STORE_URLS.ANDROID);
  });
});

describe('evaluateUpdate', () => {
  const info = (over: Record<string, unknown> = {}) => ({
    latestVersion: '1.4.0',
    minimumVersion: '1.2.0',
    updateRequired: false,
    ...over,
  });

  it('says nothing when the installed version is current', () => {
    expect(evaluateUpdate('1.4.0', info(), 'ios').kind).toBe('none');
    expect(evaluateUpdate('1.5.0', info(), 'ios').kind).toBe('none');
  });

  it('offers an optional update when behind the latest', () => {
    const d = evaluateUpdate('1.3.0', info(), 'ios');
    expect(d.kind).toBe('optional');
    expect(d.latestVersion).toBe('1.4.0');
  });

  it('blocks when below the minimum', () => {
    expect(evaluateUpdate('1.1.9', info(), 'ios').kind).toBe('mandatory');
  });

  it('treats exactly the minimum as acceptable', () => {
    expect(evaluateUpdate('1.2.0', info(), 'ios').kind).toBe('optional');
  });

  it('honours updateRequired as a promotion from optional', () => {
    expect(evaluateUpdate('1.3.0', info({ updateRequired: true }), 'ios').kind).toBe('mandatory');
  });

  // A stray updateRequired must not be able to lock out someone already on the
  // newest build: the dialog's only button would take them to a store page
  // reading "Open", leaving no way forward at all.
  it('will not block a courier who is already up to date', () => {
    expect(evaluateUpdate('1.4.0', info({ updateRequired: true }), 'ios').kind).toBe('none');
    expect(evaluateUpdate('2.0.0', info({ updateRequired: true }), 'ios').kind).toBe('none');
  });

  // Fails open throughout: a malformed payload must never strand a working app.
  it('says nothing when the payload is unusable', () => {
    expect(evaluateUpdate('1.0.0', null, 'ios').kind).toBe('none');
    expect(evaluateUpdate('1.0.0', {}, 'ios').kind).toBe('none');
    expect(evaluateUpdate('1.0.0', info({ latestVersion: 'garbage', minimumVersion: 'x' }), 'ios').kind).toBe('none');
    expect(evaluateUpdate(undefined, info(), 'ios').kind).toBe('none');
  });

  it('uses numeric ordering, not string ordering', () => {
    // "1.10.0" < "1.9.0" as strings — a string compare would nag a courier who
    // is on the NEWER build to install an older one.
    expect(evaluateUpdate('1.10.0', info({ latestVersion: '1.9.0' }), 'ios').kind).toBe('none');
    expect(evaluateUpdate('1.9.0', info({ latestVersion: '1.10.0' }), 'ios').kind).toBe('optional');
    expect(evaluateUpdate('2.0.0', info({ latestVersion: '1.99.99' }), 'ios').kind).toBe('none');
  });

  it('always returns a platform-correct store URL', () => {
    const wrong = { ...info(), storeUrl: 'https://play.google.com/store/apps/details?id=x' };
    expect(evaluateUpdate('1.0.0', wrong, 'ios').storeUrl).toBe(STORE_URLS.IOS);
    expect(evaluateUpdate('1.0.0', wrong, 'android').storeUrl).toBe(wrong.storeUrl);
  });
});
