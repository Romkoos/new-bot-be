/**
 * Result of one content preparation run.
 *
 * This is returned by the orchestrator to entry points (CLI, later API/Cron).
 */
export interface PrepareContentResult {
  /**
   * Number of source `news_items` selected for preparation (unprocessed only).
   */
  readonly sourceItemsCount: number;

  /**
   * Number of output strings produced by the processor.
   */
  readonly preparedStringsCount: number;

  /**
   * The inserted row id in `prepared_content`, or `null` when there was nothing to do.
   */
  readonly preparedContentId: number | null;

  /**
   * Number of `news_items` rows marked as processed by the persistence step.
   */
  readonly markedProcessedCount: number;

  /**
   * Total duration of the use-case execution.
   */
  readonly durationMs: number;
}

