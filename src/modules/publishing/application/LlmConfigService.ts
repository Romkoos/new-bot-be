import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

type DbLlmConfigRow = {
  readonly id: 1;
  readonly model_id: number;
  readonly model_name: string | null;
  readonly instructions: string;
  readonly updated_at: string;
};

export type LlmConfig = {
  readonly model: string;
  readonly instructions: string;
  readonly updatedAt: string;
};

export type LlmConfigResult = { readonly ok: true; readonly config: LlmConfig } | { readonly ok: false; readonly error: string };

/**
 * Loads and updates the single-row LLM configuration stored in SQLite (`llm_config`).
 *
 * Runtime guarantees:
 * - If the config row does not exist, callers MUST treat it as a fatal error (this service throws).
 * - If the row exists but values are invalid (empty strings), callers MUST skip execution.
 *
 * Notes:
 * - This is intentionally minimal and DB-specific (no extra abstractions).
 * - This service MUST NOT provide any defaults; the DB row is the source of truth.
 */
export class LlmConfigService {
  private readonly db: Database.Database;
  private readonly timestampFormatter: UtcIsoTimestampFormatterPort;

  public constructor(params: { readonly sqlitePath: string; readonly timestampFormatter: UtcIsoTimestampFormatterPort }) {
    ensureSqliteParentDirectory(params.sqlitePath);
    this.db = new Database(params.sqlitePath);
    this.timestampFormatter = params.timestampFormatter;
    this.ensureSchema();
    this.migrateLegacySchemaIfNeeded();
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
   * Loads the single config row (`id = 1`).
   *
   * @throws if the config row does not exist (table is empty).
   */
  public loadOrThrow(): LlmConfigResult {
    const row = this.db
      .prepare<unknown[], DbLlmConfigRow>(
        `
        SELECT
          c.id,
          c.model_id,
          m.name AS model_name,
          c.instructions,
          c.updated_at
        FROM llm_config c
        LEFT JOIN llm_models m
          ON m.id = c.model_id
        WHERE c.id = 1
        `.trim(),
      )
      .get();

    if (!row) {
      throw new Error(
        "LlmConfigService: missing llm_config row (id=1). Runtime execution is blocked until it is inserted.",
      );
    }

    return validateConfigRow(row);
  }

  /**
   * Creates or updates the single config row (`id = 1`).
   *
   * Minimal validation:
   * - `model` must be a non-empty string
   * - `instructions` must be a non-empty string
   *
   * @returns `{ ok:false }` if validation fails (callers should surface a 400 / skip execution).
   */
  public upsert(input: { readonly model: string; readonly instructions: string }): LlmConfigResult {
    if (typeof input.model !== "string" || !input.model.trim()) {
      return { ok: false, error: "model must be a non-empty string." };
    }
    if (typeof input.instructions !== "string" || !input.instructions.trim()) {
      return { ok: false, error: "instructions must be a non-empty string." };
    }

    const modelName = input.model.trim();
    const modelId = this.resolveOrCreateModelIdByName(modelName);

    const nowIso = this.timestampFormatter.nowUtcIso();
    const stmt = this.db.prepare(
      `
      INSERT INTO llm_config (id, model_id, instructions, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model_id = excluded.model_id,
        instructions = excluded.instructions,
        updated_at = excluded.updated_at
      `.trim(),
    );

    stmt.run(modelId, input.instructions, nowIso);

    return {
      ok: true,
      config: {
        model: modelName,
        instructions: input.instructions,
        updatedAt: nowIso,
      },
    };
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

      CREATE TABLE IF NOT EXISTS llm_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        model_id INTEGER NOT NULL,
        instructions TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (model_id) REFERENCES llm_models(id)
      );
      `.trim(),
    );
  }

  private migrateLegacySchemaIfNeeded(): void {
    // Legacy schema (2026-01-17): llm_config(id, model TEXT, instructions, updated_at)
    // New schema: llm_config(id, model_id INTEGER, instructions, updated_at)
    const tableInfo = this.db
      .prepare<unknown[], { readonly name: string }>(`PRAGMA table_info(llm_config);`)
      .all();

    // No table yet (fresh DB) -> ensureSchema() already created the new one.
    if (tableInfo.length === 0) return;

    const cols = new Set(tableInfo.map((r) => r.name));
    if (cols.has("model_id")) return; // already migrated
    if (!cols.has("model")) return; // unknown shape; do not attempt to migrate

    const legacyRow = this.db
      .prepare<unknown[], { readonly model: string; readonly instructions: string; readonly updated_at: string }>(
        `
        SELECT model, instructions, updated_at
        FROM llm_config
        WHERE id = 1
        `.trim(),
      )
      .get();

    const tx = this.db.transaction(() => {
      this.db.exec(
        `
        CREATE TABLE llm_config__new (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          model_id INTEGER NOT NULL,
          instructions TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (model_id) REFERENCES llm_models(id)
        );
        `.trim(),
      );

      if (legacyRow) {
        const modelName = legacyRow.model.trim();
        const modelId = this.resolveOrCreateModelIdByName(modelName);
        this.db
          .prepare(
            `
            INSERT INTO llm_config__new (id, model_id, instructions, updated_at)
            VALUES (1, ?, ?, ?)
            `.trim(),
          )
          .run(modelId, legacyRow.instructions, legacyRow.updated_at);
      }

      this.db.exec("DROP TABLE llm_config;");
      this.db.exec("ALTER TABLE llm_config__new RENAME TO llm_config;");
    });

    tx();
  }

  private resolveOrCreateModelIdByName(modelName: string): number {
    const selectModelStmt = this.db.prepare<{ readonly name: string }, { readonly id: number }>(
      `
      SELECT id
      FROM llm_models
      WHERE name = :name
      `.trim(),
    );

    const existing = selectModelStmt.get({ name: modelName });
    if (existing) return existing.id;

    // Fallback policy (safe default for legacy behavior):
    // - If a model name is unknown, create it under the Gemini LLM.
    // This preserves the previous "free-text model string" contract without breaking startup/migration.
    const gemini = this.db
      .prepare<unknown[], { readonly id: number }>(
        `
        SELECT id
        FROM llms
        WHERE name = 'gemini'
        `.trim(),
      )
      .get();

    if (!gemini) {
      throw new Error(
        'LlmConfigService: cannot auto-create model because base LLM "gemini" is missing. Ensure LlmCatalogService seeding runs on boot.',
      );
    }

    const insert = this.db
      .prepare(
        `
        INSERT INTO llm_models (llm_id, name)
        VALUES (?, ?)
        `.trim(),
      )
      .run(gemini.id, modelName);

    return Number(insert.lastInsertRowid);
  }
}

function validateConfigRow(row: DbLlmConfigRow): LlmConfigResult {
  // Keep validation minimal and deterministic.
  const model = (row.model_name ?? "").trim();
  const instructions = row.instructions;

  if (!model) return { ok: false, error: "Invalid llm_config: model must be a non-empty string." };
  if (typeof instructions !== "string" || !instructions.trim()) {
    return { ok: false, error: "Invalid llm_config: instructions must be a non-empty string." };
  }

  return {
    ok: true,
    config: {
      model,
      instructions,
      updatedAt: row.updated_at,
    },
  };
}

function ensureSqliteParentDirectory(sqlitePath: string): void {
  // Special case supported by SQLite: in-memory database.
  if (sqlitePath === ":memory:") return;

  // If a relative file path is used (default: ./data/news-bot.sqlite), ensure the directory exists.
  const dir = dirname(sqlitePath);
  mkdirSync(dir, { recursive: true });
}

