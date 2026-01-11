import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";

type DbNewsItemRow = {
  readonly id: number;
  readonly raw_text: string;
};

type TableInfoRow = {
  readonly name: string;
};

/**
 * SQLite adapter for the publishing module.
 *
 * Responsibilities:
 * - Select unprocessed news items (selection semantics match the previous `content-preparation` module).
 * - Persist digests and track publish status.
 * - Mark selected `news_items` as processed when a pending digest is persisted (atomic transaction).
 *
 * Schema strategy:
 * - This repo follows the project pattern: schema is ensured/extended on initialization.
 */
export class SqlitePublishingRepo implements NewsSelectionPort, DigestRepositoryPort {
  private readonly db: Database.Database;
  private readonly timestampFormatter: UtcIsoTimestampFormatterPort;

  public constructor(params: { readonly sqlitePath: string; readonly timestampFormatter: UtcIsoTimestampFormatterPort }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
    this.timestampFormatter = params.timestampFormatter;
    this.ensureSchema();
    this.dropLegacyPreparedContentTableIfExists();
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

  /**
   * Selection semantics:
   * - Matches the previous logic in `SqliteContentPreparationRepo`.
   * - Only change: returns strings (JSON strings for traceability), not objects.
   */
  public async findUnprocessedNewsTexts(): Promise<ReadonlyArray<string>> {
    const stmt = this.db.prepare<unknown[], DbNewsItemRow>(
      `
      SELECT
        id,
        raw_text
      FROM news_items
      WHERE processed = 0
      ORDER BY id ASC
      `.trim(),
    );

    const rows = stmt.all();

    // Return JSON strings so the orchestrator can deterministically recover `id` for traceability.
    return rows.map((r) => JSON.stringify({ id: r.id, rawText: r.raw_text }));
  }

  public async createPendingDigest(input: {
    readonly digestText: string;
    readonly sourceItemIds: ReadonlyArray<number>;
    readonly sourceNewsTexts: ReadonlyArray<string>;
    readonly llmModel?: string;
  }): Promise<{ readonly digestId: number }> {
    if (input.sourceItemIds.length === 0) {
      throw new Error("createPendingDigest: sourceItemIds must not be empty.");
    }
    if (input.sourceNewsTexts.length === 0) {
      throw new Error("createPendingDigest: sourceNewsTexts must not be empty.");
    }

    const nowIso = this.timestampFormatter.nowUtcIso();

    const insertDigestStmt = this.db.prepare(
      `
      INSERT INTO digests (
        created_at,
        updated_at,
        digest_text,
        is_published,
        source_items_count,
        source_item_ids_json,
        source_news_texts_json,
        llm_model,
        published_at,
        publisher_external_id
      )
      VALUES (?, ?, ?, 0, ?, ?, ?, ?, NULL, NULL)
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

    const tx = this.db.transaction((args: typeof input) => {
      const insertInfo = insertDigestStmt.run(
        nowIso,
        nowIso,
        args.digestText,
        args.sourceItemIds.length,
        JSON.stringify(args.sourceItemIds),
        JSON.stringify(args.sourceNewsTexts),
        args.llmModel ?? null,
      );

      const digestId = Number(insertInfo.lastInsertRowid);

      markProcessedStmt.run(...args.sourceItemIds);

      return { digestId };
    });

    return tx(input);
  }

  public async markDigestPublished(input: {
    readonly digestId: number;
    readonly finalDigestText: string;
    readonly publisherExternalId?: string;
  }): Promise<void> {
    const nowIso = this.timestampFormatter.nowUtcIso();
    const stmt = this.db.prepare(
      `
      UPDATE digests
      SET
        updated_at = ?,
        digest_text = ?,
        is_published = 1,
        published_at = ?,
        publisher_external_id = ?
      WHERE id = ?
      `.trim(),
    );

    stmt.run(nowIso, input.finalDigestText, nowIso, input.publisherExternalId ?? null, input.digestId);
  }

  private ensureSchema(): void {
    // Ensure base table exists (publishing depends on it, and it may be used before ingestion runs).
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
      CREATE TABLE IF NOT EXISTS digests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        digest_text TEXT NOT NULL,
        is_published INTEGER NOT NULL DEFAULT 0,
        source_items_count INTEGER NOT NULL,
        source_item_ids_json TEXT NOT NULL,
        source_news_texts_json TEXT NOT NULL,
        llm_model TEXT NULL,
        published_at TEXT NULL,
        publisher_external_id TEXT NULL
      );
      `.trim(),
    );
  }

  private dropLegacyPreparedContentTableIfExists(): void {
    // We are intentionally removing the old `prepared_content` storage surface.
    // This is a one-way operation for local/dev DBs and should be done with care in production.
    try {
      this.db.exec("DROP TABLE IF EXISTS prepared_content;");
      return;
    } catch {
      // In rare cases (e.g., a partially-corrupted schema), SQLite can retain an entry in `sqlite_schema`
      // that makes `DROP TABLE` fail with errors like:
      // - "Could not find schema for table: prepared_content"
      //
      // We perform a narrowly-scoped cleanup for this legacy table only.
      this.db.exec("PRAGMA writable_schema = 1;");
      this.db.exec(
        `
        DELETE FROM sqlite_schema
        WHERE name = 'prepared_content'
        `.trim(),
      );
      this.db.exec("PRAGMA writable_schema = 0;");
      this.db.exec("VACUUM;");
    }
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

