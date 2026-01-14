/**
 * Port for selecting news texts to include in a digest.
 *
 * Provider-agnostic by design:
 * - Implementations may read from any storage/source.
 * - Implementations must return **strings** (not objects) to keep the boundary stable.
 *
 * Note: This port is allowed to return structured strings (e.g., JSON strings) as long as
 * the return type remains `string[]`. This enables deterministic traceability (source ids)
 * without leaking adapter types into orchestrator contracts.
 */
export interface NewsSelectionPort {
  /**
   * Returns the set of unprocessed news texts to be considered for digest creation.
   *
   * Selection semantics are owned by the adapter. For the SQLite adapter, this must
   * match the project’s existing behavior: select rows from `news_items` where
   * `processed = 0` ordered by `id ASC`.
   */
  findUnprocessedNewsTexts(): Promise<ReadonlyArray<string>>;
}

