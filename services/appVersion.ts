import { Platform } from 'react-native';
import { BASE_URL, API_ENDPOINTS, STORE_URLS, VERSION_CHECK_CONFIG } from '@/constants/config';
import { isOlderThan } from '@/lib/semver';
import logger from '@/lib/logger';

/**
 * Release metadata from `GET /api/v1/app/version?platform=ios|android&app=courier`.
 *
 * Everything is optional because this is the one endpoint that must keep
 * working when the app and the backend disagree about everything else — it is
 * what gets the courier onto a build that agrees again. A missing or malformed
 * field degrades the check; it never breaks the app.
 */
export interface AppVersionInfo {
  latestVersion?: string;
  minimumVersion?: string;
  updateRequired?: boolean;
  storeUrl?: string;
}

export type UpdateKind = 'none' | 'optional' | 'mandatory';

export interface UpdateDecision {
  kind: UpdateKind;
  /** The version being offered, for the prompt and for the "already nagged" record. */
  latestVersion: string | null;
  /** Where to send them. Always platform-correct. */
  storeUrl: string;
}

/** The store URL for the platform this build is running on. */
export function platformStoreUrl(): string {
  return Platform.OS === 'ios' ? STORE_URLS.IOS : STORE_URLS.ANDROID;
}

/**
 * Is the host the right store for this platform?
 */
function storeHostIsRight(value: string, os: string): boolean {
  if (os === 'ios') {
    return /^https:\/\/(apps|itunes)\.apple\.com\//i.test(value) ||
      /^itms-apps:\/\//i.test(value);
  }
  if (os === 'android') {
    return /^https:\/\/play\.google\.com\/store\/apps\//i.test(value) ||
      /^market:\/\//i.test(value);
  }
  return false;
}

/**
 * The token that identifies WHICH app a store link points at:
 * `id6807758268` for Apple, the `id=` package name for Play.
 */
function storeAppIdentity(value: string, os: string): string | null {
  if (os === 'ios') {
    const m = value.match(/\bid(\d{6,})\b/);
    return m ? m[1] : null;
  }
  const m = value.match(/[?&]id=([A-Za-z0-9_.]+)/);
  return m ? m[1] : null;
}

/**
 * Does a URL point at THIS app's listing on THIS platform?
 *
 * Two separate checks, and the second one is not paranoia.
 *
 * The host check catches the obvious error — a Play link sent to an iPhone —
 * where the failure is silent: the button works, a web page loads, nothing
 * installs, and the courier is stranded with no error to report.
 *
 * The identity check catches the subtler one. The backend's first draft of this
 * endpoint returned a Play URL for `id=app.zbr.customer` — the CUSTOMER app.
 * Correct host, correct platform, wrong product: a courier tapping "Update"
 * would install the customer app and still not have the update. Comparing
 * against our own configured link means the check follows the app rather than
 * needing a constant kept in step by hand.
 */
export function isStoreUrlForThisPlatform(
  url: unknown,
  os: string = Platform.OS
): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false;

  const value = url.trim();
  if (!storeHostIsRight(value, os)) return false;

  const expected = storeAppIdentity(os === 'ios' ? STORE_URLS.IOS : STORE_URLS.ANDROID, os);
  const actual = storeAppIdentity(value, os);

  // If our own configured URL carries no identity there is nothing to compare
  // against, so the host check stands alone rather than rejecting everything.
  if (!expected) return true;
  return actual === expected;
}

/**
 * The URL to actually open: the backend's if it is right for this platform,
 * otherwise the configured one.
 */
export function resolveStoreUrl(backendUrl: unknown, os: string = Platform.OS): string {
  if (isStoreUrlForThisPlatform(backendUrl, os)) {
    return (backendUrl as string).trim();
  }
  if (typeof backendUrl === 'string' && backendUrl.trim() !== '') {
    logger.warn(
      '[appVersion] Ignoring storeUrl from the backend: it is not a',
      os,
      'store link. Falling back to the configured URL.'
    );
  }
  return os === 'ios' ? STORE_URLS.IOS : STORE_URLS.ANDROID;
}

/**
 * Decide what to show, from the installed version and what the backend said.
 *
 * Pure, so the rules are testable without a network or a device.
 *
 * Mandatory wins over optional. `updateRequired` from the backend is honoured
 * as an override, but ONLY together with a usable version comparison — a stray
 * `updateRequired: true` must not be able to lock out a courier who is already
 * on the newest build, which would leave them staring at a dialog whose button
 * takes them to a store page saying "Open".
 */
export function evaluateUpdate(
  installedVersion: unknown,
  info: AppVersionInfo | null | undefined,
  os: string = Platform.OS
): UpdateDecision {
  const storeUrl = resolveStoreUrl(info?.storeUrl, os);
  const latestVersion = typeof info?.latestVersion === 'string' ? info.latestVersion : null;

  if (!info) return { kind: 'none', latestVersion: null, storeUrl };

  // Below the floor the backend will no longer serve: blocking.
  if (isOlderThan(installedVersion, info.minimumVersion)) {
    return { kind: 'mandatory', latestVersion, storeUrl };
  }

  const behindLatest = isOlderThan(installedVersion, info.latestVersion);

  // The flag can promote an optional update to mandatory, but cannot invent one.
  if (info.updateRequired === true && behindLatest) {
    return { kind: 'mandatory', latestVersion, storeUrl };
  }

  if (behindLatest) {
    return { kind: 'optional', latestVersion, storeUrl };
  }

  return { kind: 'none', latestVersion, storeUrl };
}

/**
 * Fetch the release metadata.
 *
 * Unauthenticated on purpose: a courier stuck on a build the backend has
 * stopped supporting may not be able to log in at all, and that is exactly when
 * they most need to be told to update.
 *
 * Never throws. A failure here must be invisible — the courier has orders to
 * deliver and the state of the update endpoint is not their problem.
 */
export async function fetchVersionInfo(): Promise<AppVersionInfo | null> {
  if (!BASE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    VERSION_CHECK_CONFIG.REQUEST_TIMEOUT_MS
  );

  try {
    // platform is REQUIRED; a missing or unknown value is a 400. There is no
    // default on purpose — a default would have to answer with one store's
    // link, and answering an iPhone with a Play link is the exact failure the
    // separation exists to prevent.
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    // `app=courier` is REQUIRED. The endpoint keys on platform AND app, and
    // defaults to `customer` when app is omitted — which is what made it answer
    // this app with the customer app's version and store link (see
    // docs/BACKEND_QUESTIONS.md §8). Without this parameter the update prompt
    // points couriers at the wrong app.
    const url = `${BASE_URL}${API_ENDPOINTS.APP.VERSION}?platform=${platform}&app=courier`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('[appVersion] version endpoint returned', response.status);
      return null;
    }

    const body = await response.json();
    // Accept both the bare object and this API's usual { success, data } envelope.
    const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
    if (!data || typeof data !== 'object') return null;

    return {
      latestVersion: typeof data.latestVersion === 'string' ? data.latestVersion : undefined,
      minimumVersion: typeof data.minimumVersion === 'string' ? data.minimumVersion : undefined,
      updateRequired: data.updateRequired === true,
      storeUrl: typeof data.storeUrl === 'string' ? data.storeUrl : undefined,
    };
  } catch (error) {
    logger.warn('[appVersion] version check failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
