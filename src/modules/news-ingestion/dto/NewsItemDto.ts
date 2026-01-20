/**
 * News item DTO returned by read-only APIs and orchestrators.
 *
 * IMPORTANT: This DTO intentionally mirrors the SQLite `news_items` table column names
 * (snake_case) to keep the contract unambiguous for "return all columns except ..." endpoints.
 *
 * Excluded columns (intentionally not present here):
 * - `hash`
 * - `payload_json`
 */
export interface NewsItemDto {
  readonly id: number;
  readonly source: string;
  readonly raw_text: string;
  readonly published_at: string | null;
  readonly scraped_at: string;
  readonly processed: 0 | 1;
  /**
   * Whether this item was matched by any configured regex filter.
   *
   * Notes:
   * - This mirrors the SQLite `news_items.filtered` column (0/1).
   * - Filtered items are excluded from digest generation, but still become `processed = 1`.
   */
  readonly filtered: 0 | 1;
  /**
   * IDs of filters that matched this item.
   *
   * Storage:
   * - Stored in SQLite column `news_items.filters_ids` as JSON text (e.g. `[1,2,3]`).
   * - Read APIs expose this as an array for convenience.
   */
  readonly filters_ids: ReadonlyArray<number>;
  readonly media_type: "video" | "image" | null;
  readonly media_url: string | null;
}

