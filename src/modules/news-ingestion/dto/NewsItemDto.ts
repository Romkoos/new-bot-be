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
  readonly media_type: "video" | "image" | null;
  readonly media_url: string | null;
}

