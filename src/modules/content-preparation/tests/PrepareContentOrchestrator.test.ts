import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DefaultContentProcessor } from "../adapters/DefaultContentProcessor";
import { SqliteContentPreparationRepo } from "../adapters/SqliteContentPreparationRepo";
import { PrepareContentOrchestrator } from "../application/PrepareContentOrchestrator";
import type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";
import type { ContentProcessorPort } from "../ports/ContentProcessorPort";
import type { ContentPreparationRepositoryPort } from "../ports/ContentPreparationRepositoryPort";
import type { Logger } from "../../../shared/observability/logger";
import { SystemUtcIsoTimestampFormatter } from "../../../shared/adapters/SystemUtcIsoTimestampFormatter";

function createTestLogger(): Logger & { readonly info: ReturnType<typeof vi.fn>; readonly error: ReturnType<typeof vi.fn> } {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

function createTempSqlitePath(): { readonly sqlitePath: string; readonly cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "news-bot-be-"));
  const sqlitePath = join(dir, "test.sqlite");
  return {
    sqlitePath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("PrepareContentOrchestrator", () => {
  it("persists prepared_content and marks only previously-unprocessed news_items as processed", async () => {
    const { sqlitePath, cleanup } = createTempSqlitePath();
    const timestampFormatter = new SystemUtcIsoTimestampFormatter();
    const repository = new SqliteContentPreparationRepo({ sqlitePath, timestampFormatter });
    try {
      // Ensure schema (including prepared_content) exists.
      // Note: we will seed using a separate DB connection to the same file path.
      const seedDb = new Database(sqlitePath);
      const insert = seedDb.prepare(
        `
        INSERT INTO news_items (source, hash, raw_text, published_at, scraped_at, payload_json, processed, media_type, media_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `.trim(),
      );
      const nowIso = new Date().toISOString();

      // Two unprocessed items (should be selected and then marked processed).
      insert.run("mako-channel12", "h1", "Text 1", null, nowIso, "{}", 0, "image", "https://example.com/1.png");
      insert.run("mako-channel12", "h2", "Text 2", "2026-01-11T10:00:00.000Z", nowIso, "{}", 0, "video", "https://example.com/2.mp4");

      // One already processed item (must be ignored).
      insert.run("mako-channel12", "h3", "Text 3", null, nowIso, "{}", 1, null, null);

      seedDb.close();

      const logger = createTestLogger();
      const processor = new DefaultContentProcessor();
      const orchestrator = new PrepareContentOrchestrator({ repository, processor, logger });

      const result = await orchestrator.run();
      expect(result.sourceItemsCount).toBe(2);
      expect(result.preparedStringsCount).toBe(2);
      expect(result.preparedContentId).toEqual(expect.any(Number));
      expect(result.markedProcessedCount).toBe(2);

      const verifyDb = new Database(sqlitePath);

      const processedRows = verifyDb
        .prepare<unknown[], { id: number; processed: number }>(`SELECT id, processed FROM news_items ORDER BY id ASC;`)
        .all();
      expect(processedRows.map((r) => r.processed)).toEqual([1, 1, 1]);

      const prepared = verifyDb
        .prepare<unknown[], { id: number; published: number; payload_json: string; source_item_ids_json: string }>(
          `SELECT id, published, payload_json, source_item_ids_json FROM prepared_content ORDER BY id ASC;`,
        )
        .all();
      expect(prepared).toHaveLength(1);
      expect(prepared[0]?.published).toBe(0);

      const payload = JSON.parse(prepared[0]!.payload_json) as { preparedStrings: string[]; sourceItemIds: number[] };
      expect(payload.preparedStrings).toHaveLength(2);
      expect(payload.sourceItemIds).toEqual([1, 2]);

      verifyDb.close();
    } finally {
      repository.close();
      cleanup();
    }
  });

  it("does not mark news_items processed when processor throws", async () => {
    const { sqlitePath, cleanup } = createTempSqlitePath();
    const timestampFormatter = new SystemUtcIsoTimestampFormatter();
    const repository = new SqliteContentPreparationRepo({ sqlitePath, timestampFormatter });
    try {
      const seedDb = new Database(sqlitePath);
      seedDb.exec(
        `
        INSERT INTO news_items (source, hash, raw_text, published_at, scraped_at, payload_json, processed, media_type, media_url)
        VALUES ('mako-channel12', 'h1', 'Text 1', NULL, '2026-01-11T10:00:00.000Z', '{}', 0, NULL, NULL);
        `.trim(),
      );
      seedDb.close();

      const logger = createTestLogger();
      const processor: ContentProcessorPort = {
        process: vi.fn(() => {
          throw new Error("boom");
        }),
      };
      const orchestrator = new PrepareContentOrchestrator({ repository, processor, logger });

      await expect(orchestrator.run()).rejects.toThrow("boom");

      const verifyDb = new Database(sqlitePath);
      const processed = verifyDb
        .prepare<unknown[], { processed: number }>(`SELECT processed FROM news_items WHERE id = 1;`)
        .get();
      expect(processed?.processed).toBe(0);

      const preparedCount = verifyDb
        .prepare<unknown[], { c: number }>(`SELECT COUNT(*) as c FROM prepared_content;`)
        .get();
      expect(preparedCount?.c).toBe(0);
      verifyDb.close();
    } finally {
      repository.close();
      cleanup();
    }
  });

  it("does not mark news_items processed when persistence fails", async () => {
    const { sqlitePath, cleanup } = createTempSqlitePath();
    const timestampFormatter = new SystemUtcIsoTimestampFormatter();
    const baseRepo = new SqliteContentPreparationRepo({ sqlitePath, timestampFormatter });
    try {
      const seedDb = new Database(sqlitePath);
      seedDb.exec(
        `
        INSERT INTO news_items (source, hash, raw_text, published_at, scraped_at, payload_json, processed, media_type, media_url)
        VALUES ('mako-channel12', 'h1', 'Text 1', NULL, '2026-01-11T10:00:00.000Z', '{}', 0, NULL, NULL);
        `.trim(),
      );
      seedDb.close();

      // Wrap the real repo, but sabotage persistence by removing the destination table before insert.
      const repository: ContentPreparationRepositoryPort = {
        findUnprocessedNewsItems: () => baseRepo.findUnprocessedNewsItems(),
        persistPreparedContentAndMarkProcessed: async (input) => {
          const sabotageDb = new Database(sqlitePath);
          sabotageDb.exec("DROP TABLE prepared_content;");
          sabotageDb.close();
          return baseRepo.persistPreparedContentAndMarkProcessed(input);
        },
      };

      const logger = createTestLogger();
      const processor: ContentProcessorPort = {
        process: (_items: ReadonlyArray<NewsItemToPrepare>) => ["x"],
      };
      const orchestrator = new PrepareContentOrchestrator({ repository, processor, logger });

      await expect(orchestrator.run()).rejects.toThrow();

      const verifyDb = new Database(sqlitePath);
      const processed = verifyDb
        .prepare<unknown[], { processed: number }>(`SELECT processed FROM news_items WHERE id = 1;`)
        .get();
      expect(processed?.processed).toBe(0);
      verifyDb.close();
    } finally {
      baseRepo.close();
      cleanup();
    }
  });
});

