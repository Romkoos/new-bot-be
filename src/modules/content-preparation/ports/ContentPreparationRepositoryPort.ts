import type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";

export interface PersistPreparedContentInput {
  /**
   * IDs of the source `news_items` rows used to generate this prepared content object.
   */
  readonly sourceItemIds: ReadonlyArray<number>;

  /**
   * JSON string containing the prepared output and any required metadata.
   */
  readonly payloadJson: string;

  /**
   * Number of source items used. This is stored for debugging/querying convenience.
   */
  readonly sourceItemsCount: number;
}

export interface PersistPreparedContentResult {
  /**
   * Inserted row id in the `prepared_content` table.
   */
  readonly preparedContentId: number;

  /**
   * Number of `news_items` rows updated to processed by the same atomic operation.
   */
  readonly markedProcessedCount: number;
}

/**
 * Persistence port for the content preparation use-case.
 *
 * Constraints:
 * - Implementations must contain no business rules (no selection rules beyond "unprocessed"; no content shaping).
 * - Implementations must provide an atomic operation that inserts prepared content and marks the source rows as processed.
 */
export interface ContentPreparationRepositoryPort {
  /**
   * Returns all `news_items` rows that are not yet processed.
   */
  findUnprocessedNewsItems(): Promise<ReadonlyArray<NewsItemToPrepare>>;

  /**
   * Inserts a row into `prepared_content` and marks all source `news_items` rows as processed.
   *
   * Atomicity requirement:
   * - If inserting the prepared content fails, none of the source rows may be marked processed.
   * - If marking the source rows processed fails, the prepared content row must not be persisted.
   */
  persistPreparedContentAndMarkProcessed(input: PersistPreparedContentInput): Promise<PersistPreparedContentResult>;
}

