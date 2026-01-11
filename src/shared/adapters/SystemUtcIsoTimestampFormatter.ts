import type { UtcIsoTimestampFormatterPort } from "../ports/UtcIsoTimestampFormatterPort";

/**
 * System adapter for `UtcIsoTimestampFormatterPort` backed by JavaScript `Date`.
 *
 * Note: `Date#toISOString()` already returns UTC ISO with milliseconds (`...ss.SSSZ`).
 */
export class SystemUtcIsoTimestampFormatter implements UtcIsoTimestampFormatterPort {
  public formatUtcIso(date: Date): string {
    return date.toISOString();
  }

  public nowUtcIso(): string {
    return new Date().toISOString();
  }
}

