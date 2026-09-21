import { Platform } from 'react-native';
import { BASE_URL, API_ENDPOINTS, STORE_URLS, VERSION_CHECK_CONFIG } from '@/constants/config';
import { isOlderThan } from '@/lib/semver';
import logger from '@/lib/logger';

/**
 * Release metadata from `GET /api/app/version`.
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
 * Does a URL point at the store for the platform we are running on?
 *
 * The backend returns a single `storeUrl`, and a single value in one JSON
 * document cannot be correct for both platforms. Sending an iPhone to a Play
 * listing gives the courier a web page they cannot install from, and the
 * failure is silent — the button "works", the page loads, nothing installs.
 *
 * Exported for tests; the decision is small but it is the one that quietly
 * strands half the fleet if it is wrong.
 */
export function isStoreUrlForThisPlatform(
  url: unknown,
  os: string = Platform.OS
): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false;

  const value = url.trim();

  if (os === 'ios') {
    // Apple's web listings, plus the itms-apps scheme that opens the App Store
    // app directly.
    return /^https:\/\/(apps|itunes)\.apple\.com\//i.test(value) ||
      /^itms-apps:\/\//i.test(value);
  }
  if (os === 'android') {
    // Play's web listing, plus the market: scheme that opens the Play app.
    return /^https:\/\/play\.google\.com\/store\/apps\//i.test(value) ||
      /^market:\/\//i.test(value);
  }
  return false;
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
    const response = await fetch(`${BASE_URL}${API_ENDPOINTS.APP.VERSION}`, {
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
