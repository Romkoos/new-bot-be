import type { MakoScrapedItem } from "../dto/MakoScrapedItem";

/**
 * Scraper port for fetching normalized Mako Channel 12 news items.
 *
 * Constraints:
 * - Implementations must be infrastructure-only (e.g. Playwright).
 * - Must return normalized data only (no hashing).
 * - Must not access persistence.
 */
export interface MakoScraperPort {
  /**
   * Scrapes the latest items from `https://www.mako.co.il/news-channel12`.
   *
   * Scraping logic requirement:
   * - In DOM, items are under `.desktop-drawer-news` and `.mc-extendable-text__content > div > div`.
   * - Take the first 5 items from the DOM tree (in DOM order).
   */
  scrapeFirstFive(): Promise<ReadonlyArray<MakoScrapedItem>>;
}

