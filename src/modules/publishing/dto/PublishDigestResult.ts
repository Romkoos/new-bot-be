/**
 * Result DTO for a single publish-digest run.
 */
export interface PublishDigestResult {
  /**
   * How many unprocessed news items were selected as input for the digest.
   */
  readonly selectedNewsCount: number;

  /**
   * Inserted digest id, or `null` when there was nothing to process.
   */
  readonly digestId: number | null;

  /**
   * Whether a digest was successfully published during this run.
   */
  readonly isPublished: boolean;

  /**
   * End-to-end duration of the orchestrator run.
   */
  readonly durationMs: number;
}

