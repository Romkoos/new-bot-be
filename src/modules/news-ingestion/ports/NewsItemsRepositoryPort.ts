import type { NewsItemDto } from "../dto/NewsItemDto";

/**
 * Persistence port for storing and querying ingested news items.
 *
 * Constraints:
 * - Implementations must contain no business logic (no scraping, no hashing, no dedup rules).
 * - Idempotency is supported by `hash` being unique at the database level.
 */
export interface NewsItemsRepositoryPort {
  /**
   * Returns the subset of hashes that already exist in storage.
   *
   * This is used by the ingestion use-case to filter out items that have already been persisted.
   */
  findExistingHashes(hashes: ReadonlyArray<string>): Promise<ReadonlySet<string>>;

  /**
   * Inserts news items into storage.
   *
   * Implementations must:
   * - set `scraped_at` (ISO) at insertion time
   * - rely on `hash` uniqueness for deduplication safety
   * - not attempt to decide which items "should" be stored (that is use-case logic)
   */
  insertMany(items: ReadonlyArray<NewNewsItemToStore>): Promise<InsertManyResult>;

  /**
   * Returns news items for the requested ids.
   *
   * Constraints:
   * - Implementations must not return `hash` or `payload_json`.
   * - The returned row order is adapter-defined; callers must not rely on it.
   *
   * @param ids - News item ids to fetch.
   */
  findByIds(ids: ReadonlyArray<number>): Promise<ReadonlyArray<NewsItemDto>>;
}

/**
 * News item payload requested to be stored.
 *
 * Note: `scraped_at` is not part of this payload; it is set by the persistence adapter at write time.
 */
export interface NewNewsItemToStore {
  readonly source: string;
  readonly hash: string;
  readonly rawText: string;
  readonly publishedAt: string | null;
  readonly payloadJson: string;
}

/**
 * Result returned from a batch insert operation.
 */
export interface InsertManyResult {
  readonly insertedCount: number;
}

