/**
 * A minimal logger wrapper to keep `console` usage centralized and swappable.
 *
 * This is intentionally tiny for the demo project. In a real system, this would be
 * the adapter boundary for structured logging, trace correlation, transports, etc.
 */
export interface Logger {
  /**
   * Logs an informational message.
   */
  info(message: string, meta?: unknown): void;

  /**
   * Logs an error message.
   */
  error(message: string, meta?: unknown): void;
}

/**
 * Creates a minimal `Logger` implementation backed by `console`.
 */
export function createConsoleLogger(): Logger {
  return {
    info(message, meta) {
      if (meta) console.info(message, meta);
      else console.info(message);
    },
    error(message, meta) {
      if (meta) console.error(message, meta);
      else console.error(message);
    },
  };
}

