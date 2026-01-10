import type { ScrapedNewsItem } from "../dto/ScrapedNewsItem";

/**
 * Scraper port for fetching normalized news items from a concrete source.
 *
 * Constraints:
 * - Implementations must be infrastructure-only (e.g. Playwright).
 * - Must return normalized data only (no hashing).
 * - Must not access persistence.
 */
export interface NewsScraperPort {
  /**
   * Stable identifier of the concrete source behind this scraper (e.g. `"site-foo"`).
   *
   * This value is used by the ingestion use-case for hashing and persistence.
   */
  readonly source: string;

  /**
   * Scrapes the latest items from the concrete source.
   *
   * Scraping logic requirement:
   * - Return items in source order (newest-first or DOM order), as implemented by the concrete scraper.
   * - Keep the selection size stable (e.g. top 5) for predictable behavior.
   */
  scrapeFirstFive(): Promise<ReadonlyArray<ScrapedNewsItem>>;
}

