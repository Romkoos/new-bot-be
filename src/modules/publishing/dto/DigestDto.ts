/**
 * Digest DTO returned by read-only APIs and orchestrators.
 *
 * IMPORTANT: This DTO intentionally mirrors the SQLite `digests` table column names
 * (snake_case) to keep the contract unambiguous for "return all columns except ..." endpoints.
 *
 * Excluded columns (intentionally not present here):
 * - `source_items_count`
 * - `source_news_texts_json`
 * - `publisher_external_id`
 */
export interface DigestDto {
  readonly id: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly digest_text: string;
  readonly is_published: 0 | 1;
  readonly source_item_ids_json: string;
  readonly llm_model: string | null;
  readonly published_at: string | null;
}

