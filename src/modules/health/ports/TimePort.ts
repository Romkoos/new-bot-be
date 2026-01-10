/**
 * A port that provides the current time.
 *
 * This is a hexagonal boundary: orchestrators depend on this abstraction,
 * and adapters implement it.
 */
export interface TimePort {
  /**
   * Returns the current time as an ISO-8601 string.
   */
  nowIso(): string;
}

