/**
 * Minimal logger.
 *
 * - `log` / `warn` are no-ops in production builds so debug output (which can
 *   include tokens, customer names/phones and full API payloads) never reaches
 *   release logcat / os_log.
 * - `error` always passes through: production crash triage needs it. Callers
 *   are still responsible for not passing PII to `error`.
 */

export const log = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const warn = (...args: unknown[]): void => {
  if (__DEV__) {
    console.warn(...args);
  }
};

export const error = (...args: unknown[]): void => {
  console.error(...args);
};

const logger = { log, warn, error };

export default logger;
