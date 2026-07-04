import {
  containsReplaceMePlaceholder,
  findPlaceholderVars,
  upgradeToSecureTransport,
} from '@/constants/config';

describe('containsReplaceMePlaceholder', () => {
  it('detects the literal eas.json placeholder values', () => {
    expect(containsReplaceMePlaceholder('REPLACE_ME_PROD_API_BASE_URL')).toBe(true);
    expect(containsReplaceMePlaceholder('REPLACE_ME_EXPO_PROJECT_ID')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(containsReplaceMePlaceholder('replace_me_prod_api_base_url')).toBe(true);
    expect(containsReplaceMePlaceholder('Replace_Me')).toBe(true);
  });

  it('detects a placeholder embedded inside an otherwise valid-looking URL', () => {
    expect(containsReplaceMePlaceholder('https://REPLACE_ME.example.com')).toBe(true);
  });

  it('passes real values and unset vars', () => {
    expect(containsReplaceMePlaceholder('https://api.zbr.uz')).toBe(false);
    expect(containsReplaceMePlaceholder('wss://api.zbr.uz/ws')).toBe(false);
    expect(containsReplaceMePlaceholder('')).toBe(false);
    expect(containsReplaceMePlaceholder(undefined)).toBe(false);
  });
});

describe('findPlaceholderVars', () => {
  it('returns the names of every env entry still holding a placeholder', () => {
    const env = {
      EXPO_PUBLIC_RORK_API_BASE_URL: 'https://api.zbr.uz',
      EXPO_PUBLIC_WS_URL: 'REPLACE_ME_PROD_WS_URL',
      EXPO_PUBLIC_PROJECT_ID: 'REPLACE_ME_EXPO_PROJECT_ID',
      EXPO_PUBLIC_CRASH_ENDPOINT: undefined,
    };
    expect(findPlaceholderVars(env)).toEqual([
      'EXPO_PUBLIC_WS_URL',
      'EXPO_PUBLIC_PROJECT_ID',
    ]);
  });

  it('returns an empty list for a fully configured env', () => {
    expect(
      findPlaceholderVars({
        EXPO_PUBLIC_RORK_API_BASE_URL: 'https://api.zbr.uz',
        EXPO_PUBLIC_ROUTING_URL: 'https://osrm.zbr.uz',
        EXPO_PUBLIC_TERMS_URL: undefined,
      })
    ).toEqual([]);
  });

  it('flags the default eas.json production profile wholesale', () => {
    // Mirrors eas.json "production".env as shipped — the guard must name
    // every single variable so the failed build is self-explanatory.
    const easProductionEnv = {
      EXPO_PUBLIC_RORK_API_BASE_URL: 'REPLACE_ME_PROD_API_BASE_URL',
      EXPO_PUBLIC_WS_URL: 'REPLACE_ME_PROD_WS_URL',
      EXPO_PUBLIC_PROJECT_ID: 'REPLACE_ME_EXPO_PROJECT_ID',
      EXPO_PUBLIC_ROUTING_URL: 'REPLACE_ME_PROD_ROUTING_URL',
      EXPO_PUBLIC_TERMS_URL: 'REPLACE_ME_TERMS_URL',
      EXPO_PUBLIC_PRIVACY_URL: 'REPLACE_ME_PRIVACY_URL',
    };
    expect(findPlaceholderVars(easProductionEnv)).toEqual(
      Object.keys(easProductionEnv)
    );
  });
});

describe('upgradeToSecureTransport', () => {
  it('upgrades http:// to https://', () => {
    expect(upgradeToSecureTransport('http://api.zbr.uz')).toBe('https://api.zbr.uz');
  });

  it('upgrades ws:// to wss://', () => {
    expect(upgradeToSecureTransport('ws://api.zbr.uz/ws')).toBe('wss://api.zbr.uz/ws');
  });

  it('is case-insensitive on the scheme', () => {
    expect(upgradeToSecureTransport('HTTP://api.zbr.uz')).toBe('https://api.zbr.uz');
    expect(upgradeToSecureTransport('WS://api.zbr.uz/ws')).toBe('wss://api.zbr.uz/ws');
  });

  it('leaves already-secure URLs untouched', () => {
    expect(upgradeToSecureTransport('https://api.zbr.uz')).toBe('https://api.zbr.uz');
    expect(upgradeToSecureTransport('wss://api.zbr.uz/ws')).toBe('wss://api.zbr.uz/ws');
  });

  it('only rewrites the scheme, never the rest of the URL', () => {
    expect(upgradeToSecureTransport('http://host/path?next=http://other')).toBe(
      'https://host/path?next=http://other'
    );
  });
});
