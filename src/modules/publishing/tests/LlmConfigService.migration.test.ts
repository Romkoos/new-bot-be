import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { LlmCatalogService } from "../application/LlmCatalogService";
import { LlmConfigService } from "../application/LlmConfigService";
import { createTempSqlite } from "./sqliteTestUtils";

describe("LlmConfigService migration", () => {
  it("migrates legacy llm_config(model TEXT) to model_id while preserving model name contract", () => {
    const tmp = createTempSqlite();
    try {
      // Create legacy schema + row.
      const db = new Database(tmp.sqlitePath);
      db.exec(
        `
        CREATE TABLE llm_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          model TEXT NOT NULL,
          instructions TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO llm_config (id, model, instructions, updated_at)
        VALUES (1, 'legacy-model-123', 'do the thing', '2026-01-17T00:00:00.000Z');
        `.trim(),
      );
      db.close();

      // Seed catalog (provides base "gemini" LLM so unknown models can be auto-created under it).
      const catalog = new LlmCatalogService({ sqlitePath: tmp.sqlitePath });
      catalog.close();

      const svc = new LlmConfigService({
        sqlitePath: tmp.sqlitePath,
        timestampFormatter: {
          nowUtcIso: () => "2026-01-19T00:00:00.000Z",
          formatUtcIso: (date: Date) => date.toISOString(),
        },
      });

      const loaded = svc.loadOrThrow();
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error(loaded.error);
      expect(loaded.config.model).toBe("legacy-model-123");
      expect(loaded.config.instructions).toBe("do the thing");
      expect(loaded.config.updatedAt).toBe("2026-01-17T00:00:00.000Z");

      svc.close();

      // Verify schema is migrated (no `model` column; has `model_id`).
      const verifyDb = new Database(tmp.sqlitePath);
      const cols = verifyDb
        .prepare<unknown[], { readonly name: string }>(`PRAGMA table_info(llm_config);`)
        .all()
        .map((r) => r.name);
      verifyDb.close();

      expect(cols).toContain("model_id");
      expect(cols).not.toContain("model");
    } finally {
      tmp.cleanup();
    }
  });
});

