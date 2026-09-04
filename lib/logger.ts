/**
 * Minimal logger.
 *
 * - `log` / `warn` are no-ops in production builds so debug output (which can
 *   include tokens, customer names/phones and full API payloads) never reaches
 *   release logcat / os_log.
 * - `error` always passes through: production crash triage needs it. Callers
 *   are still responsible for not passing PII to `error`.
 */

const log = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args);
  }
};

const warn = (...args: unknown[]): void => {
  if (__DEV__) {
    console.warn(...args);
  }
};

const error = (...args: unknown[]): void => {
  console.error(...args);
};

/**
 * The single public shape. These were also exported individually, which made
 * `logger.error(...)` indistinguishable (to a linter, and to a reader) from a
 * mistaken default import. One way in means the question does not arise.
 */
const logger = { log, warn, error };

export default logger;
