/**
 * Token Manager — the SINGLE authority for auth tokens.
 *
 * Every refresh path in the app (ApiClient 401-retries, CourierContext /
 * WebSocket token provider, the headless background location task) goes
 * through THIS module, so a rotated refresh token can never be double-spent
 * by parallel refresh stacks, and a rotation performed by one path is
 * immediately visible to all the others.
 *
 * Design:
 * - In-memory {accessToken, refreshToken} cache backed by tokenStorage
 *   (SecureStore on native, AsyncStorage on web — owned by services/api).
 * - ONE module-level single-flight refresh promise.
 * - Storage is the cross-JS-context source of truth: refresh() re-reads the
 *   stored refresh token before spending it, and re-checks storage once more
 *   before declaring the session dead — a concurrent context (e.g. a headless
 *   Android task revival) may have rotated it successfully in the meantime.
 * - subscribe() delivers token-change events: 'rotated' (new token pair),
 *   'cleared' (tokens removed), 'session-dead' (refresh definitively
 *   rejected — the session is over). Headless contexts simply have no
 *   listeners; the foreground picks up the cleared storage on resume/restart.
 */

import { BASE_URL, API_ENDPOINTS, TOKEN_CONFIG } from '@/constants/config';
import { tokenStorage, NetworkError, ApiRequestError } from '@/services/api';
import { warn, error as logError } from '@/lib/logger';

// ============================================================================
// Events
// ============================================================================

export type TokenEvent =
  | { type: 'rotated'; accessToken: string; refreshToken: string }
  | { type: 'cleared' }
  | { type: 'session-dead' };

export type TokenListener = (event: TokenEvent) => void;

// ============================================================================
// Module state
// ============================================================================

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
// True once the cache reflects an authoritative value (loaded from storage,
// or explicitly set/cleared) — prevents a slow storage read from clobbering
// tokens that were set while it was in flight.
let cacheLoaded = false;
// THE single-flight refresh promise for this JS context.
let refreshInFlight: Promise<string | null> | null = null;

const listeners = new Set<TokenListener>();

function notify(event: TokenEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      logError('[TokenManager] Token listener failed:', err);
    }
  });
}

/**
 * Subscribe to token-change events (rotation AND definitive session death).
 * Returns an unsubscribe function.
 */
export function subscribe(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ============================================================================
// JWT expiry check (moved from CourierContext — shared by all refresh paths)
// ============================================================================

/**
 * Decode a JWT's exp claim; returns true when the token is expired or expires
 * within TOKEN_CONFIG.REFRESH_THRESHOLD_MS. Returns false when exp cannot be
 * determined — better to attempt using the token than to block on it.
 */
export const isAccessTokenExpiringSoon = (token: string): boolean => {
  try {
    const payloadPart = token.split('.')[1];
    const atobFn: ((data: string) => string) | undefined = (globalThis as any).atob;
    if (!payloadPart || typeof atobFn !== 'function') {
      return false;
    }
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atobFn(padded));
    if (typeof payload.exp !== 'number') {
      return false;
    }
    return payload.exp * 1000 - Date.now() < TOKEN_CONFIG.REFRESH_THRESHOLD_MS;
  } catch {
    return false;
  }
};

// ============================================================================
// Cache <-> storage
// ============================================================================

async function ensureLoaded(): Promise<void> {
  if (cacheLoaded) {
    return;
  }
  try {
    const [access, refreshTok] = await Promise.all([
      tokenStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY),
      tokenStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY),
    ]);
    // setTokens/clearTokens may have run while we were reading — they are
    // authoritative, so never clobber them with the (older) storage values.
    if (!cacheLoaded) {
      cachedAccessToken = access;
      cachedRefreshToken = refreshTok;
      cacheLoaded = true;
    }
  } catch (err) {
    logError('[TokenManager] Failed to load tokens from storage:', err);
  }
}

/**
 * Current access token: cached, storage-backed. Does NOT check expiry —
 * use getValidAccessToken() when a usable token is required.
 */
export async function getAccessToken(): Promise<string | null> {
  await ensureLoaded();
  return cachedAccessToken;
}

/**
 * Persist a new token pair (cache + storage) and notify listeners.
 */
export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  cachedAccessToken = accessToken;
  cachedRefreshToken = refreshToken;
  cacheLoaded = true;
  await tokenStorage.setItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY, accessToken);
  await tokenStorage.setItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY, refreshToken);
  notify({ type: 'rotated', accessToken, refreshToken });
}

/**
 * Drop the token pair from memory AND storage, then notify listeners.
 * Used on logout and on definitive session death — clearing storage is what
 * prevents any other JS context from replaying a revoked refresh token.
 */
export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  cacheLoaded = true;
  await tokenStorage.removeItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
  await tokenStorage.removeItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
  notify({ type: 'cleared' });
}

// ============================================================================
// Refresh
// ============================================================================

/**
 * Single-flight token refresh.
 *
 * Returns the new access token, `null` on a DEFINITIVE rejection (the
 * refresh token is dead — tokens are purged from memory AND storage and a
 * 'session-dead' event is emitted), and THROWS on transport/5xx failures
 * (the session may still be valid — nothing is cleared).
 */
export async function refresh(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  const inFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = inFlight;
  return inFlight;
}

async function doRefresh(): Promise<string | null> {
  await ensureLoaded();

  // Storage is the cross-context source of truth: another JS context (e.g.
  // the headless background location task) may have rotated the refresh
  // token since this context cached it — always spend the STORED one.
  let spentRefreshToken: string | null = null;
  try {
    spentRefreshToken = await tokenStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
  } catch (err) {
    logError('[TokenManager] Failed to re-read stored refresh token:', err);
  }
  spentRefreshToken = spentRefreshToken ?? cachedRefreshToken;

  if (!spentRefreshToken) {
    // No session to refresh (and none to kill)
    return null;
  }
  cachedRefreshToken = spentRefreshToken;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: spentRefreshToken }),
    });
  } catch (err: any) {
    // Transport failure — do NOT treat as an auth failure; keep the session
    logError('[TokenManager] Token refresh network error:', err);
    throw new NetworkError(err?.message || 'Token refresh network error');
  }

  if (response.status === 401 || response.status === 403) {
    return handleDefinitiveRejection(spentRefreshToken);
  }

  if (!response.ok) {
    // Transient server error (5xx etc.) — keep the session, let caller retry
    throw new ApiRequestError(`Token refresh failed with status ${response.status}`, response.status);
  }

  let data: { success?: boolean; data?: { accessToken?: string; refreshToken?: string } };
  try {
    data = await response.json();
  } catch {
    throw new ApiRequestError('Token refresh returned an invalid response', response.status);
  }

  if (data.success && data.data?.accessToken && data.data?.refreshToken) {
    await setTokens(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  }

  // Server answered 2xx but rejected the refresh — definitive
  return handleDefinitiveRejection(spentRefreshToken);
}

/**
 * The server definitively rejected the refresh token we spent. Before
 * declaring the session dead, re-read storage ONCE more: a concurrent JS
 * context may have rotated the token successfully between our storage read
 * and the server's rejection (making OUR token the stale, already-spent one).
 * If storage now holds a DIFFERENT refresh token, adopt the stored pair as
 * success instead of killing a healthy session.
 */
async function handleDefinitiveRejection(spentRefreshToken: string): Promise<string | null> {
  try {
    const storedRefresh = await tokenStorage.getItem(TOKEN_CONFIG.REFRESH_TOKEN_KEY);
    if (storedRefresh && storedRefresh !== spentRefreshToken) {
      const storedAccess = await tokenStorage.getItem(TOKEN_CONFIG.ACCESS_TOKEN_KEY);
      if (storedAccess) {
        warn('[TokenManager] Refresh rejected but a concurrent rotation succeeded — adopting stored tokens');
        cachedAccessToken = storedAccess;
        cachedRefreshToken = storedRefresh;
        cacheLoaded = true;
        notify({ type: 'rotated', accessToken: storedAccess, refreshToken: storedRefresh });
        return storedAccess;
      }
    }
  } catch (err) {
    logError('[TokenManager] Failed to re-check stored tokens after refresh rejection:', err);
  }

  // Definitive death: purge memory AND storage so no context (foreground or
  // headless) can replay the revoked token, then tell listeners. In a
  // headless context no listeners exist — the foreground discovers the
  // cleared storage on resume/restart and lands on the login screen.
  warn('[TokenManager] Refresh token definitively rejected — session is dead');
  await clearTokens();
  notify({ type: 'session-dead' });
  return null;
}

/**
 * A token that is safe to present right now: refreshes first when the cached
 * access token is expired/expiring. Returns null when there is no session
 * (or it just died). On transport failures during refresh the CURRENT token
 * is returned — it may still be accepted, and the caller's retry loop will
 * come back through here for another refresh attempt.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }
  if (!isAccessTokenExpiringSoon(token)) {
    return token;
  }
  try {
    const refreshed = await refresh();
    return refreshed ?? cachedAccessToken;
  } catch (err) {
    // Network error during refresh — try the current token anyway
    warn('[TokenManager] Refresh before use failed, using current token:', err);
    return cachedAccessToken;
  }
}

const tokenManager = {
  getAccessToken,
  getValidAccessToken,
  refresh,
  setTokens,
  clearTokens,
  subscribe,
  isAccessTokenExpiringSoon,
};

export default tokenManager;
