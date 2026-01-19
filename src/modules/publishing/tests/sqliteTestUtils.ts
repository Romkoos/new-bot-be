import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TempSqlite = {
  readonly sqlitePath: string;
  cleanup(): void;
};

/**
 * Creates a temporary directory and returns a sqlite file path inside it.
 *
 * We use a real file (not `:memory:`) because the app uses independent SQLite connections,
 * and in-memory DBs are not shared across connections in a straightforward way.
 */
export function createTempSqlite(): TempSqlite {
  const dir = mkdtempSync(join(tmpdir(), "news-bot-be-sqlite-test-"));
  const sqlitePath = join(dir, "test.sqlite");
  return {
    sqlitePath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

