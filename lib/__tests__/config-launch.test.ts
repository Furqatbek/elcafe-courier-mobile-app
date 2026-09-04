/**
 * The app must LAUNCH even when its build environment is missing.
 *
 * constants/config.ts used to `throw` at module scope when
 * EXPO_PUBLIC_RORK_API_BASE_URL was unset in a production build. app/_layout.tsx
 * imports it on its ninth line, so that throw ran during module evaluation —
 * before React rendered, before the ErrorBoundary existed, before the global
 * handler in initCrashReporting() was reachable. React Native reports an
 * unhandled JS error at that point through RCTExceptionsManager, which raises an
 * ObjC exception and calls abort(): SIGABRT ~150ms after launch, blank screen.
 * App Store review rejected the app under guideline 2.1(a), "crashed on launch"
 * (submission dfca40b5-ac4b-4aed-bcbc-c2bb383f53a4).
 *
 * These tests pin the two properties that matter:
 *   1. importing the config NEVER throws, whatever the environment
 *   2. a broken environment is still detected, and says which var is at fault
 */

declare const global: { __DEV__: boolean } & typeof globalThis;

const RELEVANT_ENV = [
  'EXPO_PUBLIC_RORK_API_BASE_URL',
  'EXPO_PUBLIC_WS_URL',
  'EXPO_PUBLIC_WS_SOCKJS_URL',
  'EXPO_PUBLIC_ROUTING_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_CRASH_ENDPOINT',
] as const;

describe('config module evaluation', () => {
  const originalDev = global.__DEV__;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.resetModules();
    for (const name of RELEVANT_ENV) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    global.__DEV__ = originalDev;
    for (const name of RELEVANT_ENV) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  });

  // require, not import: the module must be re-evaluated after each
  // resetModules() so a different environment produces a different result.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loadConfig = () => require('@/constants/config');

  it('does not throw in a production build with NO environment at all', () => {
    global.__DEV__ = false;
    expect(() => loadConfig()).not.toThrow();
  });

  it('reports the missing API address instead of throwing', () => {
    global.__DEV__ = false;
    const { CONFIG_ERROR } = loadConfig();
    expect(CONFIG_ERROR).not.toBeNull();
    expect(CONFIG_ERROR.vars).toContain('EXPO_PUBLIC_RORK_API_BASE_URL');
    // The message is shown to whoever opens the app — a reviewer, a tester —
    // so it has to say what to do, not just what is wrong.
    expect(CONFIG_ERROR.message).toMatch(/EXPO_PUBLIC_RORK_API_BASE_URL/);
  });

  it('reports unreplaced REPLACE_ME placeholders instead of throwing', () => {
    global.__DEV__ = false;
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL = 'https://REPLACE_ME_PROD_API_BASE_URL';
    const { CONFIG_ERROR } = loadConfig();
    expect(CONFIG_ERROR).not.toBeNull();
    expect(CONFIG_ERROR.vars).toContain('EXPO_PUBLIC_RORK_API_BASE_URL');
  });

  it('is clean when the environment is complete', () => {
    global.__DEV__ = false;
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL = 'https://zbrr.uz';
    const { CONFIG_ERROR, BASE_URL } = loadConfig();
    expect(CONFIG_ERROR).toBeNull();
    expect(BASE_URL).toBe('https://zbrr.uz');
  });

  // A missing address must never silently resolve to somewhere else. Empty is
  // the only safe value: every request built from it fails immediately.
  it('never invents a fallback origin in a production build', () => {
    global.__DEV__ = false;
    const { BASE_URL } = loadConfig();
    expect(BASE_URL).toBe('');
  });

  it('still falls back to localhost in development', () => {
    global.__DEV__ = true;
    const { BASE_URL, CONFIG_ERROR } = loadConfig();
    expect(BASE_URL).toBe('http://localhost:8080');
    expect(CONFIG_ERROR).toBeNull();
  });
});
