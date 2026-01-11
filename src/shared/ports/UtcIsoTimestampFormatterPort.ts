/**
 * Formats timestamps into a canonical UTC ISO-8601 representation for persistence/logging.
 *
 * Canonical format requirement:
 * - Always UTC (`Z` suffix).
 * - Always include milliseconds: `YYYY-MM-DDTHH:mm:ss.SSSZ`.
 *
 * Rationale:
 * - Avoids subtle inconsistencies between `Date#toISOString()` and library-specific format defaults.
 * - Keeps timestamp formatting rules centralized and reusable across modules.
 */
export interface UtcIsoTimestampFormatterPort {
  /**
   * Formats the given `Date` into canonical UTC ISO.
   */
  formatUtcIso(date: Date): string;

  /**
   * Returns the current time in canonical UTC ISO.
   */
  nowUtcIso(): string;
}

