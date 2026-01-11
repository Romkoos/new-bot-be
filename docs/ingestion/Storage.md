# Storage (SQLite schema + repository behavior)

## Purpose / scope

This document describes:

- The SQLite schema used to persist ingested items.
- The repository adapter behavior (`findExistingHashes`, `insertMany`).
- How DB-level deduplication works (UNIQUE + INSERT OR IGNORE).
- How storage participates in idempotency.

## Where it lives

- Repository port: `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts`
- SQLite adapter: `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`
- DI wiring: `src/app/di/container.ts`

## SQLite file location

DI chooses the SQLite file path from env:

- `NEWS_BOT_SQLITE_PATH` (default: `./data/news-bot.sqlite`)

The adapter ensures the parent directory exists for file-backed DBs.

Special case supported:

- `sqlitePath === ":memory:"` (in-memory DB)

## Schema: `news_items`

The repository ensures the schema exists on initialization:

- `CREATE TABLE IF NOT EXISTS news_items (...)`

Columns:

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `source TEXT NOT NULL`
- `hash TEXT NOT NULL UNIQUE`
- `raw_text TEXT NOT NULL`
- `published_at TEXT NULL` (ISO string or null)
- `scraped_at TEXT NOT NULL` (ISO string set at insertion time)
- `payload_json TEXT NOT NULL` (serialized normalized payload)
- `processed INTEGER NOT NULL DEFAULT 0` (0/1; used by content preparation to track whether a row has been processed)
- `media_type TEXT NULL` (allowed values: `video` or `image`, otherwise `NULL`)
- `media_url TEXT NULL` (URL string, otherwise `NULL`)

### Why `source` exists

Even though `hash` is unique, `source` is stored to:

- support future multi-source ingestion
- simplify querying by source
- preserve provenance

The ingestion flow stores `source` for every row. The value is provided by the configured scraper adapter and is intentionally stable for that adapter to preserve DB continuity.

### Why store `payload_json`

`payload_json` stores the normalized representation used by the orchestrator when persisting:

- source
- hash
- rawText
- publishedAt

This provides a “debug payload” that makes it easier to inspect what was stored without reconstructing from logs.

## Repository API

### `findExistingHashes(hashes)`

Purpose:

- Provide the ingestion use-case a fast way to filter duplicates before inserting.

Behavior:

- If input list is empty:
  - returns `new Set()`
- Otherwise:
  - builds a parameterized `IN (?, ?, ...)` query
  - returns a `Set<string>` containing any hashes already present

Notes:

- This is a pure read method.
- It intentionally contains no business rules beyond “does this hash exist”.

### `insertMany(items)`

Purpose:

- Insert a batch of items into SQLite.

Key behavior:

- If input list is empty:
  - returns `{ insertedCount: 0 }`
- Uses a single prepared statement:
  - `INSERT OR IGNORE INTO news_items (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
- Sets `scraped_at` once for the entire batch:
  - `const nowIso = new Date().toISOString()`
- Executes inserts inside a SQLite transaction:
  - sums `info.changes` for each insert
  - returns total inserted rows as `insertedCount`

Notes:

- The ingestion flow currently does not populate `media_type` / `media_url` yet; the storage adapter writes `NULL` values for these fields for now.

### Deduplication semantics

Because the statement is `INSERT OR IGNORE` and `hash` is `UNIQUE`:

- inserting an item whose hash already exists:
  - does not throw
  - returns `changes = 0`
- inserting a new hash:
  - inserts a row
  - returns `changes = 1`

This makes `insertMany` safe even if the orchestrator accidentally passes duplicates (it should not, but DB is the backstop).

## Idempotency participation

Storage participates in idempotency via:

- `UNIQUE(hash)` constraint
- `INSERT OR IGNORE` behavior

