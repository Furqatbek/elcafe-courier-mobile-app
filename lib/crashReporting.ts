/**
 * Minimal crash reporting scaffold.
 *
 * Installs a global handler for uncaught JS errors:
 * - Native: ErrorUtils.setGlobalHandler (chains to the previous handler so
 *   the default RN fatal behavior / dev redbox is preserved).
 * - Web: window.onerror + unhandledrejection.
 *
 * Every crash is logged via logger.error. If EXPO_PUBLIC_CRASH_ENDPOINT is
 * set, a fire-and-forget POST with { message, stack, platform, appVersion }
 * is sent there — no retries, no queue, failures are swallowed.
 *
 * Sentry upgrade path: when a real crash-reporting backend is adopted,
 * replace this module with @sentry/react-native —
 *   1. npx expo install @sentry/react-native
 *   2. add the "@sentry/react-native/expo" plugin to app.config.ts (org,
 *      project, and SENTRY_AUTH_TOKEN as an EAS secret for sourcemap upload)
 *   3. call Sentry.init({ dsn }) here inside initCrashReporting() and delete
 *      the manual handlers below (Sentry installs its own), keeping this
 *      module as the single integration point so app/_layout.tsx and the
 *      ErrorBoundary don't change.
 */

import { Platform } from 'react-native';
import { APP_CONFIG } from '@/constants/config';
import logger from '@/lib/logger';

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
}

let installed = false;

/**
 * Report an error to the crash endpoint (if configured) and the logger.
 * Safe to call from anywhere (e.g. the ErrorBoundary's onError).
 */
export function reportCrash(err: unknown, isFatal?: boolean): void {
  const e = err instanceof Error ? err : new Error(String(err));

  logger.error(
    `[crashReporting] ${isFatal ? 'Fatal' : 'Unhandled'} error:`,
    e.message,
    e.stack ?? '(no stack)'
  );

  const endpoint = process.env.EXPO_PUBLIC_CRASH_ENDPOINT;
  if (!endpoint) return;

  try {
    // Fire-and-forget: a crash reporter must never crash (or block) the app
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: e.message,
        stack: e.stack ?? '',
        platform: Platform.OS,
        appVersion: APP_CONFIG.VERSION,
      }),
    }).catch(() => {});
  } catch {
    // JSON.stringify / fetch setup failed — nothing useful to do
  }
}

/**
 * Install the global uncaught-error handlers. Idempotent; call once at
 * app startup (app/_layout.tsx).
 */
export function initCrashReporting(): void {
  if (installed) return;
  installed = true;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;

    const previousOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, err) => {
      reportCrash(err ?? message, true);
      if (typeof previousOnError === 'function') {
        return previousOnError.call(window, message, source, lineno, colno, err);
      }
      return false;
    };

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      reportCrash(event.reason, false);
    });
    return;
  }

  // Native: ErrorUtils is a React Native global
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) {
    logger.warn('[crashReporting] ErrorUtils not available; global handler not installed');
    return;
  }

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportCrash(error, isFatal);
    // Preserve default RN behavior (dev redbox / production fatal handling)
    previousHandler?.(error, isFatal);
  });
}
