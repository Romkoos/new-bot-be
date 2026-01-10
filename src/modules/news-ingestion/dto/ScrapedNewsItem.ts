/**
 * Normalized news item scraped from a concrete source site.
 *
 * Scraping rules:
 * - Scraping returns normalized data only.
 * - Scraping must not generate hashes.
 * - Scraping must not access persistence.
 */
export interface ScrapedNewsItem {
  /**
   * The main teaser/text content extracted from the DOM.
   *
   * Note: This is not yet hash-normalized (hash normalization happens in the ingestion use-case).
   */
  readonly text: string;

  /**
   * Optional publish time, represented as an ISO string, or `null` when unavailable.
   */
  readonly publishedAt: string | null;
}

