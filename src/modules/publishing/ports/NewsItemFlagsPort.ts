/**
 * Port for updating derived flags on `news_items` during publishing flows.
 *
 * This exists to keep `PublishDigestOrchestrator` free of persistence details while allowing
 * the flow to:
 * - exclude filtered items from digest generation
 * - still mark them as processed so they stop reappearing
 * - persist traceability (`filters_ids`) for why an item was filtered
 */
export interface NewsItemFlagsPort {
  /**
   * Marks the given news items as filtered and processed, and stores the matching filter ids.
   *
   * Implementations must treat this as a best-effort, idempotent update.
   *
   * @param input.items - Items to update; `filterIds` should be deterministic (sorted, unique).
   */
  markItemsFilteredAndProcessed(input: {
    readonly items: ReadonlyArray<{ readonly id: number; readonly filterIds: ReadonlyArray<number> }>;
  }): Promise<void>;
}

