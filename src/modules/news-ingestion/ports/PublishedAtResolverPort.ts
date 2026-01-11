/**
 * Resolves a publish timestamp from a scraper-provided time string (typically `HH:mm`).
 *
 * Purpose:
 * - Centralize timezone-aware interpretation of partial timestamps coming from scraping UI.
 * - Keep scraper adapters focused on DOM extraction, delegating time semantics elsewhere.
 *
 * Expected behavior:
 * - Implementations may apply timezone rules and date rollover logic (e.g. around midnight).
 * - Returns an ISO timestamp string (`toISOString()`-compatible) or `null` when input is not parseable.
 */
export interface PublishedAtResolverPort {
  /**
   * Converts a time-like string into an ISO timestamp string or `null`.
   *
   * @param timeText - Raw text extracted from the page (may include extra whitespace or markers).
   */
  resolveIsoOrNull(timeText: string): string | null;
}

