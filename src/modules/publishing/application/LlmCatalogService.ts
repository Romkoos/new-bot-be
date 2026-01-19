import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type LlmDto = {
  readonly id: number;
  readonly name: string;
  readonly alias: string;
};

export type LlmModelDto = {
  readonly id: number;
  readonly llm_id: number;
  readonly name: string;
};

export type LlmCatalogSeed = {
  readonly llmName: string;
  readonly llmAlias: string;
  readonly modelName: string;
};

export type CatalogResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/**
 * SQLite-backed registry of:
 * - LLM providers (`llms`: name + alias)
 * - Models (`llm_models`: model name linked to an LLM)
 *
 * This service is DB-specific on purpose (publishing uses SQLite directly).
 *
 * NOTE:
 * - Schema is ensured on initialization (project convention).
 * - Seeding is idempotent (safe to call on every boot).
 */
export class LlmCatalogService {
  private readonly db: Database.Database;

  public constructor(params: { readonly sqlitePath: string; readonly seed?: ReadonlyArray<LlmCatalogSeed> }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
    // Enforce referential integrity when running CRUD / seeding.
    this.db.pragma("foreign_keys = ON");
    this.ensureSchema();
    this.seedDefaults(params.seed ?? [DEFAULT_SEED]);
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
   * Returns all LLM providers, ordered by `id` ascending.
   */
  public listLlms(): CatalogResult<ReadonlyArray<LlmDto>> {
    try {
      const rows = this.db
        .prepare<unknown[], LlmDto>(
          `
          SELECT id, name, alias
          FROM llms
          ORDER BY id ASC
          `.trim(),
        )
        .all();
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: `Failed to list LLMs: ${String(error)}` };
    }
  }

  /**
   * Returns all models for a given LLM, ordered by `id` ascending.
   *
   * @returns `{ ok:false }` with "not found" error if the LLM id does not exist.
   */
  public listModelsByLlmId(input: { readonly llmId: number }): CatalogResult<ReadonlyArray<LlmModelDto>> {
    if (!Number.isInteger(input.llmId) || input.llmId <= 0) return { ok: false, error: "llmId must be a positive integer." };

    const llmExists = this.db
      .prepare<unknown[], { readonly id: number }>(
        `
        SELECT id
        FROM llms
        WHERE id = ?
        `.trim(),
      )
      .get(input.llmId);

    if (!llmExists) return { ok: false, error: `LLM not found (id=${input.llmId}).` };

    try {
      const rows = this.db
        .prepare<unknown[], LlmModelDto>(
          `
          SELECT id, llm_id, name
          FROM llm_models
          WHERE llm_id = ?
          ORDER BY id ASC
          `.trim(),
        )
        .all(input.llmId);
      return { ok: true, value: rows };
    } catch (error) {
      return { ok: false, error: `Failed to list models: ${String(error)}` };
    }
  }

  /**
   * Creates a new LLM provider.
   *
   * Constraints:
   * - `name` is unique and case-sensitive (SQLite default collation).
   */
  public createLlm(input: { readonly name: string; readonly alias: string }): CatalogResult<LlmDto> {
    const name = input.name.trim();
    const alias = input.alias.trim();
    if (!name) return { ok: false, error: "name must be a non-empty string." };
    if (!alias) return { ok: false, error: "alias must be a non-empty string." };

    try {
      const info = this.db
        .prepare(
          `
          INSERT INTO llms (name, alias)
          VALUES (?, ?)
          `.trim(),
        )
        .run(name, alias);

      return { ok: true, value: { id: Number(info.lastInsertRowid), name, alias } };
    } catch (error) {
      return { ok: false, error: `Failed to create LLM: ${String(error)}` };
    }
  }

  /**
   * Updates an existing LLM provider.
   *
   * At least one of `name` or `alias` must be provided.
   */
  public updateLlm(input: { readonly id: number; readonly name?: string; readonly alias?: string }): CatalogResult<LlmDto> {
    if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: "id must be a positive integer." };

    const name = input.name === undefined ? undefined : input.name.trim();
    const alias = input.alias === undefined ? undefined : input.alias.trim();
    if (name !== undefined && !name) return { ok: false, error: "name must be a non-empty string." };
    if (alias !== undefined && !alias) return { ok: false, error: "alias must be a non-empty string." };
    if (name === undefined && alias === undefined) return { ok: false, error: "At least one of name or alias must be provided." };

    const existing = this.db
      .prepare<unknown[], LlmDto>(
        `
        SELECT id, name, alias
        FROM llms
        WHERE id = ?
        `.trim(),
      )
      .get(input.id);

    if (!existing) return { ok: false, error: `LLM not found (id=${input.id}).` };

    const nextName = name ?? existing.name;
    const nextAlias = alias ?? existing.alias;

    try {
      this.db
        .prepare(
          `
          UPDATE llms
          SET name = ?, alias = ?
          WHERE id = ?
          `.trim(),
        )
        .run(nextName, nextAlias, input.id);

      return { ok: true, value: { id: input.id, name: nextName, alias: nextAlias } };
    } catch (error) {
      return { ok: false, error: `Failed to update LLM: ${String(error)}` };
    }
  }

  /**
   * Deletes an LLM provider.
   *
   * Safety:
   * - Deletion is blocked if the current `llm_config` references any model under this LLM.
   */
  public deleteLlm(input: { readonly id: number }): CatalogResult<{ readonly deleted: true }> {
    if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: "id must be a positive integer." };

    const inUse = this.db
      .prepare<unknown[], { readonly cnt: number }>(
        `
        SELECT COUNT(1) AS cnt
        FROM llm_config c
        JOIN llm_models m ON m.id = c.model_id
        WHERE c.id = 1 AND m.llm_id = ?
        `.trim(),
      )
      .get(input.id);

    if (inUse && inUse.cnt > 0) {
      return { ok: false, error: "Cannot delete LLM: it has a model currently referenced by llm_config." };
    }

    const info = this.db
      .prepare(
        `
        DELETE FROM llms
        WHERE id = ?
        `.trim(),
      )
      .run(input.id);

    if (info.changes === 0) return { ok: false, error: `LLM not found (id=${input.id}).` };
    return { ok: true, value: { deleted: true } };
  }

  /**
   * Creates a model linked to an existing LLM.
   */
  public createModel(input: { readonly llmId: number; readonly name: string }): CatalogResult<LlmModelDto> {
    if (!Number.isInteger(input.llmId) || input.llmId <= 0) return { ok: false, error: "llmId must be a positive integer." };
    const name = input.name.trim();
    if (!name) return { ok: false, error: "name must be a non-empty string." };

    const llmExists = this.db
      .prepare<unknown[], { readonly id: number }>(
        `
        SELECT id
        FROM llms
        WHERE id = ?
        `.trim(),
      )
      .get(input.llmId);

    if (!llmExists) return { ok: false, error: `LLM not found (id=${input.llmId}).` };

    try {
      const info = this.db
        .prepare(
          `
          INSERT INTO llm_models (llm_id, name)
          VALUES (?, ?)
          `.trim(),
        )
        .run(input.llmId, name);

      return { ok: true, value: { id: Number(info.lastInsertRowid), llm_id: input.llmId, name } };
    } catch (error) {
      return { ok: false, error: `Failed to create model: ${String(error)}` };
    }
  }

  /**
   * Updates a model (its name and/or linked LLM).
   *
   * At least one of `llmId` or `name` must be provided.
   */
  public updateModel(input: {
    readonly id: number;
    readonly llmId?: number;
    readonly name?: string;
  }): CatalogResult<LlmModelDto> {
    if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: "id must be a positive integer." };
    const llmId = input.llmId;
    const name = input.name === undefined ? undefined : input.name.trim();
    if (llmId !== undefined && (!Number.isInteger(llmId) || llmId <= 0)) return { ok: false, error: "llmId must be a positive integer." };
    if (name !== undefined && !name) return { ok: false, error: "name must be a non-empty string." };
    if (llmId === undefined && name === undefined) return { ok: false, error: "At least one of llmId or name must be provided." };

    const existing = this.db
      .prepare<unknown[], LlmModelDto>(
        `
        SELECT id, llm_id, name
        FROM llm_models
        WHERE id = ?
        `.trim(),
      )
      .get(input.id);

    if (!existing) return { ok: false, error: `Model not found (id=${input.id}).` };

    const nextLlmId = llmId ?? existing.llm_id;
    const nextName = name ?? existing.name;

    if (llmId !== undefined) {
      const llmExists = this.db
        .prepare<unknown[], { readonly id: number }>(
          `
          SELECT id
          FROM llms
          WHERE id = ?
          `.trim(),
        )
        .get(nextLlmId);
      if (!llmExists) return { ok: false, error: `LLM not found (id=${nextLlmId}).` };
    }

    try {
      this.db
        .prepare(
          `
          UPDATE llm_models
          SET llm_id = ?, name = ?
          WHERE id = ?
          `.trim(),
        )
        .run(nextLlmId, nextName, input.id);

      return { ok: true, value: { id: input.id, llm_id: nextLlmId, name: nextName } };
    } catch (error) {
      return { ok: false, error: `Failed to update model: ${String(error)}` };
    }
  }

  /**
   * Deletes a model.
   *
   * Safety:
   * - Deletion is blocked if `llm_config` currently references this model.
   */
  public deleteModel(input: { readonly id: number }): CatalogResult<{ readonly deleted: true }> {
    if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: "id must be a positive integer." };

    const inUse = this.db
      .prepare<unknown[], { readonly cnt: number }>(
        `
        SELECT COUNT(1) AS cnt
        FROM llm_config
        WHERE id = 1 AND model_id = ?
        `.trim(),
      )
      .get(input.id);

    if (inUse && inUse.cnt > 0) {
      return { ok: false, error: "Cannot delete model: it is currently referenced by llm_config." };
    }

    const info = this.db
      .prepare(
        `
        DELETE FROM llm_models
        WHERE id = ?
        `.trim(),
      )
      .run(input.id);

    if (info.changes === 0) return { ok: false, error: `Model not found (id=${input.id}).` };
    return { ok: true, value: { deleted: true } };
  }

  private ensureSchema(): void {
    this.db.exec(
      `
      CREATE TABLE IF NOT EXISTS llms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        alias TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS llm_models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        llm_id INTEGER NOT NULL,
        name TEXT NOT NULL UNIQUE,
        FOREIGN KEY (llm_id) REFERENCES llms(id) ON DELETE CASCADE
      );
      `.trim(),
    );
  }

  private seedDefaults(seeds: ReadonlyArray<LlmCatalogSeed>): void {
    const upsertLlmStmt = this.db.prepare(
      `
      INSERT INTO llms (name, alias)
      VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET
        alias = excluded.alias
      `.trim(),
    );

    const selectLlmIdStmt = this.db.prepare<{ readonly name: string }, { readonly id: number }>(
      `
      SELECT id
      FROM llms
      WHERE name = :name
      `.trim(),
    );

    const upsertModelStmt = this.db.prepare(
      `
      INSERT INTO llm_models (llm_id, name)
      VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET
        llm_id = excluded.llm_id
      `.trim(),
    );

    const tx = this.db.transaction((items: ReadonlyArray<LlmCatalogSeed>) => {
      for (const seed of items) {
        const llmName = seed.llmName.trim();
        const llmAlias = seed.llmAlias.trim();
        const modelName = seed.modelName.trim();

        if (!llmName) throw new Error("LlmCatalogService.seedDefaults: llmName must be non-empty.");
        if (!llmAlias) throw new Error("LlmCatalogService.seedDefaults: llmAlias must be non-empty.");
        if (!modelName) throw new Error("LlmCatalogService.seedDefaults: modelName must be non-empty.");

        upsertLlmStmt.run(llmName, llmAlias);

        const row = selectLlmIdStmt.get({ name: llmName });
        if (!row) {
          throw new Error(`LlmCatalogService.seedDefaults: failed to load llm id for name="${llmName}".`);
        }

        upsertModelStmt.run(row.id, modelName);
      }
    });

    tx(seeds);
  }
}

const DEFAULT_SEED: LlmCatalogSeed = {
  llmName: "gemini",
  llmAlias: "Gemini",
  modelName: "gemini-2.0-flash-lite",
};

function ensureSqliteParentDirectory(sqlitePath: string): void {
  // Special case supported by SQLite: in-memory database.
  if (sqlitePath === ":memory:") return;

  // If a relative file path is used (default: ./data/news-bot.sqlite), ensure the directory exists.
  const dir = dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
}

