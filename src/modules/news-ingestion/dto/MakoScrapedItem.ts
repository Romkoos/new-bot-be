/**
 * Normalized news item scraped from the Mako Channel 12 page.
 *
 * Scraping rules:
 * - Scraping returns normalized data only.
 * - Scraping must not generate hashes.
 * - Scraping must not access persistence.
 */
export interface MakoScrapedItem {
  /**
   * The main teaser/text content extracted from the DOM.
   *
   * Note: This is not yet hash-normalized (hash normalization happens in the ingestion use-case).
   */
  readonly text: string;

  /**
   * Optional publish time, represented as an ISO string, or `null` when unavailable.
   *
   * Source DOM provides `"HH:mm"`; the scraper converts it to ISO using today's date.
   */
  readonly publishedAt: string | null;
}

