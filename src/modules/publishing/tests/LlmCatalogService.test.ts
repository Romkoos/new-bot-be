import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { LlmCatalogService } from "../application/LlmCatalogService";
import { createTempSqlite } from "./sqliteTestUtils";

describe("LlmCatalogService", () => {
  it("lists LLMs and lists models by LLM id", () => {
    const tmp = createTempSqlite();
    try {
      // Ensure `llm_config` exists so delete guards can query it (matches runtime).
      const bootstrapDb = new Database(tmp.sqlitePath);
      bootstrapDb.exec(
        `
        CREATE TABLE IF NOT EXISTS llm_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          model_id INTEGER NOT NULL,
          instructions TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        `.trim(),
      );
      bootstrapDb.close();

      const svc = new LlmCatalogService({ sqlitePath: tmp.sqlitePath });

      const llms = svc.listLlms();
      expect(llms.ok).toBe(true);
      if (!llms.ok) throw new Error(llms.error);
      expect(llms.value.some((l) => l.name === "gemini")).toBe(true);

      const geminiId = llms.value.find((l) => l.name === "gemini")?.id;
      expect(typeof geminiId).toBe("number");

      const models = svc.listModelsByLlmId({ llmId: geminiId as number });
      expect(models.ok).toBe(true);
      if (!models.ok) throw new Error(models.error);
      expect(models.value.some((m) => m.name === "gemini-2.0-flash-lite")).toBe(true);

      svc.close();
    } finally {
      tmp.cleanup();
    }
  });

  it("creates/updates/deletes LLM providers", () => {
    const tmp = createTempSqlite();
    try {
      // Ensure `llm_config` exists so delete guards can query it (matches runtime).
      const bootstrapDb = new Database(tmp.sqlitePath);
      bootstrapDb.exec(
        `
        CREATE TABLE IF NOT EXISTS llm_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          model_id INTEGER NOT NULL,
          instructions TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        `.trim(),
      );
      bootstrapDb.close();

      const svc = new LlmCatalogService({ sqlitePath: tmp.sqlitePath });

      const created = svc.createLlm({ name: "openai", alias: "OpenAI" });
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error(created.error);

      const updated = svc.updateLlm({ id: created.value.id, alias: "OpenAI (Renamed)" });
      expect(updated.ok).toBe(true);
      if (!updated.ok) throw new Error(updated.error);
      expect(updated.value.alias).toBe("OpenAI (Renamed)");

      const deleted = svc.deleteLlm({ id: created.value.id });
      expect(deleted.ok).toBe(true);

      svc.close();
    } finally {
      tmp.cleanup();
    }
  });

  it("creates/updates/deletes models and blocks deleting the model referenced by llm_config", () => {
    const tmp = createTempSqlite();
    try {
      // Ensure `llm_config` exists so delete guards can query it (matches runtime).
      const bootstrapDb = new Database(tmp.sqlitePath);
      bootstrapDb.exec(
        `
        CREATE TABLE IF NOT EXISTS llm_config (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          model_id INTEGER NOT NULL,
          instructions TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        `.trim(),
      );
      bootstrapDb.close();

      // Create a new LLM and a model under it.
      const svc = new LlmCatalogService({ sqlitePath: tmp.sqlitePath });
      const llm = svc.createLlm({ name: "x-ai", alias: "xAI" });
      expect(llm.ok).toBe(true);
      if (!llm.ok) throw new Error(llm.error);

      const model = svc.createModel({ llmId: llm.value.id, name: "grok-2" });
      expect(model.ok).toBe(true);
      if (!model.ok) throw new Error(model.error);

      // Point llm_config at this model to activate delete guard.
      svc.close();
      const db = new Database(tmp.sqlitePath);
      db.exec("PRAGMA foreign_keys = ON;");
      db.prepare(
        `
        INSERT INTO llm_config (id, model_id, instructions, updated_at)
        VALUES (1, ?, 'x', '2026-01-19T00:00:00.000Z')
        ON CONFLICT(id) DO UPDATE SET
          model_id = excluded.model_id,
          instructions = excluded.instructions,
          updated_at = excluded.updated_at
        `.trim(),
      ).run(model.value.id);
      db.close();

      // Re-open service and verify deletion is blocked.
      const svc2 = new LlmCatalogService({ sqlitePath: tmp.sqlitePath });
      const blocked = svc2.deleteModel({ id: model.value.id });
      expect(blocked.ok).toBe(false);
      if (blocked.ok) throw new Error("Expected deletion to be blocked.");
      expect(blocked.error).toContain("llm_config");

      // Move llm_config away, then deletion should succeed.
      const dbLookup = new Database(tmp.sqlitePath);
      const geminiModelRow = dbLookup
        .prepare<unknown[], { readonly id: number }>(
          `
          SELECT id
          FROM llm_models
          WHERE name = 'gemini-2.0-flash-lite'
          `.trim(),
        )
        .get();
      dbLookup.close();

      const geminiModelId = geminiModelRow?.id;
      expect(typeof geminiModelId).toBe("number");

      const db2 = new Database(tmp.sqlitePath);
      db2.exec("PRAGMA foreign_keys = ON;");
      db2.prepare(
        `
        UPDATE llm_config
        SET model_id = ?
        WHERE id = 1
        `.trim(),
      ).run(geminiModelId);
      db2.close();

      const deleted = svc2.deleteModel({ id: model.value.id });
      expect(deleted.ok).toBe(true);

      svc2.close();
    } finally {
      tmp.cleanup();
    }
  });
});

