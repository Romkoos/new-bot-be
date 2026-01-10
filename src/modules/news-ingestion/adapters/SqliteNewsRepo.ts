import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { InsertManyResult, NewNewsItemToStore, NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";

/**
 * SQLite-backed repository for ingested news items.
 *
 * Constraints:
 * - Persistence only: no scraping, hashing, filtering, or other business rules.
 * - Deduplication safety is enforced by `UNIQUE(hash)` at the database layer.
 */
export class SqliteNewsRepo implements NewsItemsRepositoryPort {
  private readonly db: Database.Database;

  public constructor(params: { readonly sqlitePath: string }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
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
      INSERT OR IGNORE INTO news_items (source, hash, raw_text, published_at, scraped_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `.trim(),
    );

    const nowIso = new Date().toISOString();

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
        payload_json TEXT NOT NULL
      );
      `.trim(),
    );
  }
}

function ensureSqliteParentDirectory(sqlitePath: string): void {
  // Special case supported by SQLite: in-memory database.
  if (sqlitePath === ":memory:") return;

  // If a relative file path is used (default: ./data/news-bot.sqlite), ensure the directory exists.
  const dir = dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
}
