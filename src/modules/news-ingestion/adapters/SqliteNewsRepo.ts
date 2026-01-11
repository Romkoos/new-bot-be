import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { InsertManyResult, NewNewsItemToStore, NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

type TableInfoRow = {
  readonly name: string;
};

/**
 * SQLite-backed repository for ingested news items.
 *
 * Constraints:
 * - Persistence only: no scraping, hashing, filtering, or other business rules.
 * - Deduplication safety is enforced by `UNIQUE(hash)` at the database layer.
 */
export class SqliteNewsRepo implements NewsItemsRepositoryPort {
  private readonly db: Database.Database;
  private readonly timestampFormatter: UtcIsoTimestampFormatterPort;

  public constructor(params: { readonly sqlitePath: string; readonly timestampFormatter: UtcIsoTimestampFormatterPort }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
    this.timestampFormatter = params.timestampFormatter;
    this.ensureSchema();
  }

  public async findExistingHashes(hashes: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
    if (hashes.length === 0) return new Set<string>();

    const placeholders = hashes.map(() => "?").join(", ");
    const stmt = this.db.prepare<unknown[], { hash: string }>(
      `SELECT hash FROM news_items WHERE hash IN (${placeholders})`,
    );

    const params = [...hashes];
    const rows = stmt.all(...params);
    return new Set(rows.map((r) => r.hash));
  }

  public async insertMany(items: ReadonlyArray<NewNewsItemToStore>): Promise<InsertManyResult> {
    if (items.length === 0) return { insertedCount: 0 };

    const insertStmt = this.db.prepare(
      `
      INSERT OR IGNORE INTO news_items (source, hash, raw_text, published_at, scraped_at, payload_json, media_type, media_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `.trim(),
    );

    const nowIso = this.timestampFormatter.nowUtcIso();

    const tx = this.db.transaction((batch: ReadonlyArray<NewNewsItemToStore>) => {
      let insertedCount = 0;
      for (const item of batch) {
        const info = insertStmt.run(
          item.source,
          item.hash,
          item.rawText,
          item.publishedAt,
          nowIso,
          item.payloadJson,
          null, // media_type (storage-only for now)
          null, // media_url (storage-only for now)
        );
        insertedCount += info.changes;
      }
      return insertedCount;
    });

    return { insertedCount: tx(items) };
  }

  private ensureSchema(): void {
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
