/**
 * services/tokenManager unit tests — mocked fetch + mocked storage.
 *
 * tokenManager keeps module-level state (cache, single-flight promise,
 * listeners), so every test re-requires a fresh module via jest.resetModules.
 */

import { TOKEN_CONFIG } from '@/constants/config';

// In-memory stand-in for the SecureStore/AsyncStorage-backed tokenStorage.
// (jest.mock factories may only reference out-of-scope vars prefixed "mock".)
const mockStore = new Map<string, string>();

jest.mock('@/services/api', () => ({
  tokenStorage: {
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStore.delete(key);
    }),
  },
  NetworkError: class NetworkError extends Error {
    constructor(message = 'Network error') {
      super(message);
      this.name = 'NetworkError';
    }
  },
  ApiRequestError: class ApiRequestError extends Error {
    code: number;
    constructor(message: string, code = 500) {
      super(message);
      this.name = 'ApiRequestError';
      this.code = code;
    }
  },
}));

const ACCESS_KEY = TOKEN_CONFIG.ACCESS_TOKEN_KEY;
const REFRESH_KEY = TOKEN_CONFIG.REFRESH_TOKEN_KEY;

type TokenManagerModule = typeof import('@/services/tokenManager').default;
type TokenEvent = import('@/services/tokenManager').TokenEvent;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const successBody = (accessToken: string, refreshToken: string) => ({
  success: true,
  data: { accessToken, refreshToken },
});

describe('tokenManager', () => {
  const originalFetch = (globalThis as any).fetch;
  let tokenManager: TokenManagerModule;
  let fetchMock: jest.Mock;
  let events: TokenEvent[];
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    // isAccessTokenExpiringSoon decodes JWTs via globalThis.atob — provide it
    // when the test runtime lacks the global (older Node)
    if (typeof (globalThis as any).atob !== 'function') {
      (globalThis as any).atob = (data: string) => Buffer.from(data, 'base64').toString('binary');
    }
  });

  beforeEach(() => {
    jest.resetModules();
    mockStore.clear();
    fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // .default: the module exposes one object, not individual named exports.
    // require, not import: re-required after resetModules() so each test starts
    // with fresh single-flight state.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tokenManager = require('@/services/tokenManager').default;
    events = [];
    tokenManager.subscribe((event) => events.push(event));
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  afterAll(() => {
    (globalThis as any).fetch = originalFetch;
  });

  const seedSession = (accessToken = 'access-0', refreshToken = 'refresh-0') => {
    mockStore.set(ACCESS_KEY, accessToken);
    mockStore.set(REFRESH_KEY, refreshToken);
  };

  describe('getAccessToken', () => {
    it('returns the stored token (storage-backed cache)', async () => {
      seedSession('access-0', 'refresh-0');
      await expect(tokenManager.getAccessToken()).resolves.toBe('access-0');
    });

    it('returns null when nothing is stored', async () => {
      await expect(tokenManager.getAccessToken()).resolves.toBeNull();
    });
  });

  describe('getTokens — read-only session-restore priming', () => {
    it('loads the stored pair on a cold cache WITHOUT writing to storage', async () => {
      seedSession('access-0', 'refresh-0');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { tokenStorage } = require('@/services/api');
      (tokenStorage.setItem as jest.Mock).mockClear();

      await expect(tokenManager.getTokens()).resolves.toEqual({
        accessToken: 'access-0',
        refreshToken: 'refresh-0',
      });
      expect(tokenStorage.setItem).not.toHaveBeenCalled();
      expect(events).toEqual([]);
    });

    it('never clobbers a rotation that landed before restore consumed it', async () => {
      // Cold start: storage holds (access-0, refresh-0). A background-task
      // refresh rotates to (access-1, refresh-1) BEFORE restoreSession reads
      // through the manager — restore must observe the rotated pair and must
      // not re-persist the spent one (the old setTokens-based restore did,
      // killing the session on the next refresh).
      seedSession('access-0', 'refresh-0');
      await tokenManager.setTokens('access-1', 'refresh-1');

      await expect(tokenManager.getTokens()).resolves.toEqual({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
      });
      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-1');
    });
  });

  describe('refresh — single-flight', () => {
    it('coalesces N concurrent refresh() calls into ONE network call', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse(successBody('access-1', 'refresh-1')));

      const results = await Promise.all([
        tokenManager.refresh(),
        tokenManager.refresh(),
        tokenManager.refresh(),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(results).toEqual(['access-1', 'access-1', 'access-1']);
      // The single request spent the STORED refresh token
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-0' });
    });

    it('allows a NEW refresh once the previous one settled', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock
        .mockResolvedValueOnce(jsonResponse(successBody('access-1', 'refresh-1')))
        .mockResolvedValueOnce(jsonResponse(successBody('access-2', 'refresh-2')));

      await expect(tokenManager.refresh()).resolves.toBe('access-1');
      await expect(tokenManager.refresh()).resolves.toBe('access-2');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Second refresh spent the rotated token, not the original
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refreshToken: 'refresh-1' });
    });

    it('returns null without a network call when no refresh token exists', async () => {
      await expect(tokenManager.refresh()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(events).toEqual([]);
    });
  });

  describe('refresh — rotation', () => {
    it('persists the new pair to storage and notifies listeners', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse(successBody('access-1', 'refresh-1')));

      await expect(tokenManager.refresh()).resolves.toBe('access-1');

      expect(mockStore.get(ACCESS_KEY)).toBe('access-1');
      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-1');
      expect(events).toEqual([
        { type: 'rotated', accessToken: 'access-1', refreshToken: 'refresh-1' },
      ]);
      await expect(tokenManager.getAccessToken()).resolves.toBe('access-1');
    });

    it('spends the STORED refresh token even when another context rotated it first', async () => {
      seedSession('access-0', 'refresh-0');
      // Prime the in-memory cache with the original pair
      await tokenManager.getAccessToken();
      // Another JS context (headless background task) rotates the pair
      mockStore.set(ACCESS_KEY, 'access-bg');
      mockStore.set(REFRESH_KEY, 'refresh-bg');
      fetchMock.mockResolvedValue(jsonResponse(successBody('access-1', 'refresh-1')));

      await expect(tokenManager.refresh()).resolves.toBe('access-1');

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-bg' });
    });
  });

  describe('refresh — definitive death', () => {
    it('clears memory AND storage and notifies session-dead on 401', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse({}, 401));

      await expect(tokenManager.refresh()).resolves.toBeNull();

      expect(mockStore.has(ACCESS_KEY)).toBe(false);
      expect(mockStore.has(REFRESH_KEY)).toBe(false);
      expect(events).toEqual([{ type: 'cleared' }, { type: 'session-dead' }]);
      await expect(tokenManager.getAccessToken()).resolves.toBeNull();
    });

    it('treats a 2xx failure payload as definitive death too', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse({ success: false, data: null }));

      await expect(tokenManager.refresh()).resolves.toBeNull();

      expect(mockStore.has(REFRESH_KEY)).toBe(false);
      expect(events).toEqual([{ type: 'cleared' }, { type: 'session-dead' }]);
    });
  });

  describe('refresh — concurrent-rotation adoption', () => {
    it('adopts the stored pair instead of dying when another context rotated meanwhile', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockImplementation(async () => {
        // While OUR request is in flight, another JS context successfully
        // rotates the pair — making the token we spent the stale one.
        mockStore.set(ACCESS_KEY, 'access-other');
        mockStore.set(REFRESH_KEY, 'refresh-other');
        return jsonResponse({}, 401);
      });

      await expect(tokenManager.refresh()).resolves.toBe('access-other');

      // Session survives: storage intact, listeners see a rotation, NO death
      expect(mockStore.get(ACCESS_KEY)).toBe('access-other');
      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-other');
      expect(events).toEqual([
        { type: 'rotated', accessToken: 'access-other', refreshToken: 'refresh-other' },
      ]);
      await expect(tokenManager.getAccessToken()).resolves.toBe('access-other');
    });
  });

  describe('refresh — transient failures keep the session', () => {
    it('throws on network error without clearing tokens or notifying', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(tokenManager.refresh()).rejects.toThrow();

      expect(mockStore.get(ACCESS_KEY)).toBe('access-0');
      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-0');
      expect(events).toEqual([]);
      await expect(tokenManager.getAccessToken()).resolves.toBe('access-0');
    });

    it('throws on 5xx without clearing tokens or notifying', async () => {
      seedSession('access-0', 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse({}, 503));

      await expect(tokenManager.refresh()).rejects.toThrow('503');

      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-0');
      expect(events).toEqual([]);
    });
  });

  describe('setTokens / clearTokens', () => {
    it('setTokens persists, caches and notifies rotation', async () => {
      await tokenManager.setTokens('access-x', 'refresh-x');

      expect(mockStore.get(ACCESS_KEY)).toBe('access-x');
      expect(mockStore.get(REFRESH_KEY)).toBe('refresh-x');
      expect(events).toEqual([
        { type: 'rotated', accessToken: 'access-x', refreshToken: 'refresh-x' },
      ]);
      await expect(tokenManager.getAccessToken()).resolves.toBe('access-x');
    });

    it('clearTokens purges memory + storage and notifies cleared', async () => {
      seedSession();
      await tokenManager.getAccessToken(); // prime cache

      await tokenManager.clearTokens();

      expect(mockStore.has(ACCESS_KEY)).toBe(false);
      expect(mockStore.has(REFRESH_KEY)).toBe(false);
      expect(events).toEqual([{ type: 'cleared' }]);
      await expect(tokenManager.getAccessToken()).resolves.toBeNull();
    });

    it('subscribe returns a working unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = tokenManager.subscribe(listener);
      unsubscribe();

      await tokenManager.setTokens('access-x', 'refresh-x');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getValidAccessToken', () => {
    const makeJwt = (expSecondsFromNow: number): string => {
      const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `header.${payload}.signature`;
    };

    it('returns the current token untouched when it is not expiring', async () => {
      const freshJwt = makeJwt(60 * 60); // 1h from now, beyond the threshold
      seedSession(freshJwt, 'refresh-0');

      await expect(tokenManager.getValidAccessToken()).resolves.toBe(freshJwt);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes first when the token is expiring soon', async () => {
      const dyingJwt = makeJwt(10); // inside REFRESH_THRESHOLD_MS
      seedSession(dyingJwt, 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse(successBody('access-1', 'refresh-1')));

      await expect(tokenManager.getValidAccessToken()).resolves.toBe('access-1');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to the current token when the refresh fails on transport', async () => {
      const dyingJwt = makeJwt(10);
      seedSession(dyingJwt, 'refresh-0');
      fetchMock.mockRejectedValue(new TypeError('Network request failed'));

      await expect(tokenManager.getValidAccessToken()).resolves.toBe(dyingJwt);
    });

    it('returns null after a definitive death', async () => {
      const dyingJwt = makeJwt(10);
      seedSession(dyingJwt, 'refresh-0');
      fetchMock.mockResolvedValue(jsonResponse({}, 401));

      await expect(tokenManager.getValidAccessToken()).resolves.toBeNull();
    });

    it('returns null when there is no session at all', async () => {
      await expect(tokenManager.getValidAccessToken()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
