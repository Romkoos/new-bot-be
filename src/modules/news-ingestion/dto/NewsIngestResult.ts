/**
 * Result DTO returned by the news ingestion use-case.
 *
 * This is designed for logging/observability (counts + timing) and for CLI output.
 */
export interface NewsIngestResult {
  /**
   * The news source identifier that was used for hashing/storage in this run.
   */
  readonly source: string;

  /**
   * Whether persistence writes were skipped.
   */
  readonly dryRun: boolean;

  /**
   * Number of items scraped from the page (after selecting the configured amount).
   */
  readonly scrapedCount: number;

  /**
   * Number of items remaining after filtering out already-known hashes.
   */
  readonly newItemsCount: number;

  /**
   * Number of items written to the database (0 when dry-run is enabled).
   */
  readonly storedCount: number;

  /**
   * Total execution time in milliseconds for the full use-case run.
   */
  readonly durationMs: number;
}

