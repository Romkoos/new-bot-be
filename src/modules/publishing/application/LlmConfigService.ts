import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

type DbLlmConfigRow = {
  readonly id: 1;
  readonly model: string;
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
          id,
          model,
          instructions,
          updated_at
        FROM llm_config
        WHERE id = 1
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

    const nowIso = this.timestampFormatter.nowUtcIso();
    const stmt = this.db.prepare(
      `
      INSERT INTO llm_config (id, model, instructions, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model = excluded.model,
        instructions = excluded.instructions,
        updated_at = excluded.updated_at
      `.trim(),
    );

    stmt.run(input.model.trim(), input.instructions, nowIso);

    return {
      ok: true,
      config: {
        model: input.model.trim(),
        instructions: input.instructions,
        updatedAt: nowIso,
      },
    };
  }

  private ensureSchema(): void {
    this.db.exec(
      `
      CREATE TABLE IF NOT EXISTS llm_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        model TEXT NOT NULL,
        instructions TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      `.trim(),
    );
  }
}

function validateConfigRow(row: DbLlmConfigRow): LlmConfigResult {
  // Keep validation minimal and deterministic.
  const model = row.model.trim();
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

