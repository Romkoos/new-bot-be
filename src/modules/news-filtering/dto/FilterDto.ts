/**
 * Filter DTO returned by filter CRUD APIs and orchestrators.
 *
 * IMPORTANT: This DTO intentionally mirrors the SQLite `filters` table column names
 * (snake_case) to keep the contract unambiguous.
 */
export interface FilterDto {
  readonly id: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly name: string;
  readonly pattern: string;
}

