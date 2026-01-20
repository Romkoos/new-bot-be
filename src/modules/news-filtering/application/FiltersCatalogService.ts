import Database from "better-sqlite3";
import type { FilterDto } from "../dto/FilterDto";
import type { FiltersResult } from "./FiltersResult";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

type DbFilterRow = FilterDto;

/**
 * Catalog service for regex-based filters.
 *
 * Responsibilities:
 * - Ensure the `filters` SQLite table exists.
 * - Provide CRUD operations for filters with deterministic error handling.
 *
 * Non-responsibilities:
 * - Applying filters to news items (owned by the publishing pipeline/use-case).
 * - Regex compilation validation (owned by orchestrators to keep this service persistence-focused).
 */
export class FiltersCatalogService {
  private readonly db: Database.Database;
  private readonly timestampFormatter: UtcIsoTimestampFormatterPort;

  public constructor(params: { readonly sqlitePath: string; readonly timestampFormatter: UtcIsoTimestampFormatterPort }) {
    this.db = new Database(params.sqlitePath);
    this.timestampFormatter = params.timestampFormatter;
    this.ensureSchema();
  }

  public close(): void {
    this.db.close();
  }

  public async listFilters(): Promise<FiltersResult<ReadonlyArray<FilterDto>>> {
    try {
      const stmt = this.db.prepare<unknown[], DbFilterRow>(
        `
        SELECT
          id,
          created_at,
          updated_at,
          name,
          pattern
        FROM filters
        ORDER BY id ASC
        `.trim(),
      );
      const rows = stmt.all();
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: `Failed to list filters: ${String(error)}` };
    }
  }

  public async createFilter(input: { readonly name: string; readonly pattern: string }): Promise<FiltersResult<FilterDto>> {
    try {
      const nowIso = this.timestampFormatter.nowUtcIso();
      const stmt = this.db.prepare(
        `
        INSERT INTO filters (created_at, updated_at, name, pattern)
        VALUES (?, ?, ?, ?)
        `.trim(),
      );

      const info = stmt.run(nowIso, nowIso, input.name, input.pattern);
      const id = Number(info.lastInsertRowid);

      return this.getByIdOrNotFound(id);
    } catch (error) {
      const mapped = mapSqliteErrorToUserMessage(error);
      return { ok: false, error: mapped ?? `Failed to create filter: ${String(error)}` };
    }
  }

  public async updateFilter(input: {
    readonly id: number;
    readonly name?: string;
    readonly pattern?: string;
  }): Promise<FiltersResult<FilterDto>> {
    try {
      const existing = this.getById(input.id);
      if (!existing) return { ok: false, error: "Filter not found." };

      const nextName = input.name ?? existing.name;
      const nextPattern = input.pattern ?? existing.pattern;
      const nowIso = this.timestampFormatter.nowUtcIso();

      const stmt = this.db.prepare(
        `
        UPDATE filters
        SET
          updated_at = ?,
          name = ?,
          pattern = ?
        WHERE id = ?
        `.trim(),
      );
      stmt.run(nowIso, nextName, nextPattern, input.id);

      return this.getByIdOrNotFound(input.id);
    } catch (error) {
      const mapped = mapSqliteErrorToUserMessage(error);
      return { ok: false, error: mapped ?? `Failed to update filter: ${String(error)}` };
    }
  }

  public async deleteFilter(input: { readonly id: number }): Promise<FiltersResult<{ readonly deleted: true }>> {
    try {
      const stmt = this.db.prepare(
        `
        DELETE FROM filters
        WHERE id = ?
        `.trim(),
      );

      const info = stmt.run(input.id);
      if (info.changes === 0) return { ok: false, error: "Filter not found." };
      return { ok: true, value: { deleted: true } };
    } catch (error) {
      return { ok: false, error: `Failed to delete filter: ${String(error)}` };
    }
  }

  private ensureSchema(): void {
    this.db.exec(
      `
      CREATE TABLE IF NOT EXISTS filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        name TEXT NOT NULL UNIQUE,
        pattern TEXT NOT NULL
      );
      `.trim(),
    );
  }

  private getByIdOrNotFound(id: number): FiltersResult<FilterDto> {
    const row = this.getById(id);
    if (!row) return { ok: false, error: "Filter not found." };
    return { ok: true, value: row };
  }

  private getById(id: number): FilterDto | null {
    const stmt = this.db.prepare<unknown[], DbFilterRow>(
      `
      SELECT
        id,
        created_at,
        updated_at,
        name,
        pattern
      FROM filters
      WHERE id = ?
      `.trim(),
    );
    return stmt.get(id) ?? null;
  }
}

function mapSqliteErrorToUserMessage(error: unknown): string | null {
  // better-sqlite3 throws SqliteError with `.code` for constraint issues, but we keep this defensive.
  const code = (error as { readonly code?: unknown }).code;
  if (code === "SQLITE_CONSTRAINT_UNIQUE") return "Filter name already exists.";
  return null;
}

