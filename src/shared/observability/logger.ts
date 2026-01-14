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
      const line = meta ? `${message} ${safeStringify(meta)}` : message;
      process.stdout.write(`${line}\n`);
    },
    error(message, meta) {
      const line = meta ? `${message} ${safeStringify(meta)}` : message;
      process.stderr.write(`${line}\n`);
    },
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, errorReplacer);
  } catch {
    return "[unserializable]";
  }
}

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause !== undefined ? { cause: value.cause } : {}),
    };
  }
  return value;
}
