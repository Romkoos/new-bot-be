import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";
import type {
  ContentPreparationRepositoryPort,
  PersistPreparedContentInput,
  PersistPreparedContentResult,
} from "../ports/ContentPreparationRepositoryPort";

type DbNewsItemRow = {
  readonly id: number;
  readonly source: string;
  readonly hash: string;
  readonly raw_text: string;
  readonly published_at: string | null;
  readonly media_type: string | null;
  readonly media_url: string | null;
};

type TableInfoRow = {
  readonly name: string;
};

/**
 * SQLite-backed repository for the content preparation use-case.
 *
 * Responsibilities:
 * - Read unprocessed `news_items`.
 * - Insert a `prepared_content` row.
 * - Mark source `news_items` rows as processed (atomically with the insert).
 *
 * Schema strategy:
 * - This repo follows the existing project pattern: schema is ensured/extended on initialization (no migrations folder).
 */
export class SqliteContentPreparationRepo implements ContentPreparationRepositoryPort {
  private readonly db: Database.Database;

  public constructor(params: { readonly sqlitePath: string }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
    this.ensureSchema();
  }

  /**
   * Closes the underlying SQLite connection.
   *
   * This is primarily useful for short-lived processes (CLI runs, tests) to release
   * file locks on Windows.
   */
  public close(): void {
    this.db.close();
  }

  public async findUnprocessedNewsItems(): Promise<ReadonlyArray<NewsItemToPrepare>> {
    const stmt = this.db.prepare<unknown[], DbNewsItemRow>(
      `
      SELECT
        id,
        source,
        hash,
        raw_text,
        published_at,
        media_type,
        media_url
      FROM news_items
      WHERE processed = 0
      ORDER BY id ASC
      `.trim(),
    );

    const rows = stmt.all();
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      hash: r.hash,
      rawText: r.raw_text,
      publishedAt: r.published_at,
      mediaType: normalizeMediaType(r.media_type),
      mediaUrl: r.media_url,
    }));
  }

  public async persistPreparedContentAndMarkProcessed(
    input: PersistPreparedContentInput,
  ): Promise<PersistPreparedContentResult> {
    if (input.sourceItemIds.length === 0) {
      throw new Error("persistPreparedContentAndMarkProcessed: sourceItemIds must not be empty.");
    }

    const nowIso = new Date().toISOString();

    const insertPreparedStmt = this.db.prepare(
      `
      INSERT INTO prepared_content (created_at, payload_json, source_items_count, source_item_ids_json)
      VALUES (?, ?, ?, ?)
      `.trim(),
    );

    const placeholders = input.sourceItemIds.map(() => "?").join(", ");
    const markProcessedStmt = this.db.prepare(
      `
      UPDATE news_items
      SET processed = 1
      WHERE id IN (${placeholders})
      `.trim(),
    );

    const tx = this.db.transaction((args: PersistPreparedContentInput) => {
      const insertInfo = insertPreparedStmt.run(
        nowIso,
        args.payloadJson,
        args.sourceItemsCount,
        JSON.stringify(args.sourceItemIds),
      );

      const preparedContentId = Number(insertInfo.lastInsertRowid);

      const updateInfo = markProcessedStmt.run(...args.sourceItemIds);

      return {
        preparedContentId,
        markedProcessedCount: updateInfo.changes,
      } satisfies PersistPreparedContentResult;
    });

    return tx(input);
  }

  private ensureSchema(): void {
    // Ensure base table exists (this module depends on it, and it may be used before ingestion runs).
    this.db.exec(
      `
      CREATE TABLE IF NOT EXISTS news_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        raw_text TEXT NOT NULL,
        published_at TEXT NULL,
        scraped_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0,
        media_type TEXT NULL,
        media_url TEXT NULL
      );
      `.trim(),
    );

    // Evolve schema for older DBs created before the new columns existed.
    this.ensureColumnExists({
      table: "news_items",
      column: "processed",
      alterSql: `ALTER TABLE news_items ADD COLUMN processed INTEGER NOT NULL DEFAULT 0;`,
    });

    this.ensureColumnExists({
      table: "news_items",
      column: "media_type",
      alterSql: `ALTER TABLE news_items ADD COLUMN media_type TEXT NULL;`,
    });

    this.ensureColumnExists({
      table: "news_items",
      column: "media_url",
      alterSql: `ALTER TABLE news_items ADD COLUMN media_url TEXT NULL;`,
    });

    this.db.exec(
      `
      CREATE TABLE IF NOT EXISTS prepared_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        source_items_count INTEGER NOT NULL,
        source_item_ids_json TEXT NOT NULL
      );
      `.trim(),
    );
  }

  private ensureColumnExists(params: { readonly table: string; readonly column: string; readonly alterSql: string }): void {
    const rows = this.db
      .prepare<unknown[], TableInfoRow>(`PRAGMA table_info(${params.table});`)
      .all();
    const existing = new Set(rows.map((r) => r.name));
    if (existing.has(params.column)) return;
    this.db.exec(params.alterSql);
  }
}

function ensureSqliteParentDirectory(sqlitePath: string): void {
  // Special case supported by SQLite: in-memory database.
  if (sqlitePath === ":memory:") return;

  // If a relative file path is used (default: ./data/news-bot.sqlite), ensure the directory exists.
  const dir = dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
}

function normalizeMediaType(value: string | null): "video" | "image" | null {
  if (value === "video") return "video";
  if (value === "image") return "image";
  return null;
}

