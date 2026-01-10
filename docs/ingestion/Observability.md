# Observability (logs and how to debug ingestion)

## Purpose / scope

This document explains:

- Which log events exist for ingestion.
- What each event means and what metadata it contains.
- How to use logs to debug failures and to verify idempotency.

## Where it lives

- Orchestrator logs: `src/modules/news-ingestion/application/MakoIngestOrch.ts`
- Entry-point logs:
  - `src/app/cron/makoIngestCron.ts`
  - `src/app/cli/makoIngestCli.ts`
- Logger implementation: `src/shared/observability/logger.ts`

## Logger model

The repo uses a minimal `Logger` abstraction:

- `logger.info(message, meta?)` writes to stdout
- `logger.error(message, meta?)` writes to stderr

`meta` is JSON-stringified with a safe fallback when serialization fails.

## Log namespaces

We use a consistent namespace scheme:

- Use-case logs (orchestrator):
  - `ingestion:mako:*`
- Cron entry point logs:
  - `cron:mako:*`
- CLI entry point logs:
  - `cli:mako:*`

Important:

- The **log namespace** is `mako`.
- The persisted `source` id in DB and DTOs remains `"mako-channel12"`.

## Orchestrator log events (`ingestion:mako:*`)

### `ingestion:mako:start`

Emitted at the start of `MakoIngestOrch.run(...)`.

Meta:

- `{ dryRun: boolean }`

### `ingestion:mako:scraped`

Emitted after scraper returns.

Meta:

- `{ count: number }` (number of scraped items returned by scraper)

### `ingestion:mako:filtered`

Emitted after hashing and filtering against existing hashes.

Meta:

- `existingCount: number` (how many of the candidate hashes already existed in storage)
- `filteredOutCount: number` (how many were removed as duplicates)
- `newItemsCount: number` (how many remain to store)

### `ingestion:mako:early-exit:no-new-items`

Emitted when `newItemsCount === 0`.

Meta:

- `{ durationMs: number }`

This is a **successful** run outcome.

### `ingestion:mako:done`

Emitted at the end of the use-case (both dry-run and persisted runs).

Meta:

- `dryRun: boolean`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`
- `durationMs: number`

## Cron log events (`cron:mako:*`)

### `Cron scheduler started (mako ingestion).`

Emitted once on cron process startup.

Meta:

- `{ schedule: string }`

### `cron:mako:ingestion:start`

Emitted for each scheduled tick before orchestrator run.

Meta:

- `{ schedule: string }`

### `cron:mako:ingestion:done`

Emitted for each tick after orchestrator run.

Meta:

- `durationMs: number`
- `source: "mako-channel12"`
- `dryRun: false`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`

### `cron:mako:ingestion:error`

Emitted on any exception thrown from orchestrator.

Meta:

- `durationMs: number`
- `error: unknown` (whatever was thrown)

## CLI log events (`cli:mako:*`)

### `cli:mako:ingestion:start`

Emitted once at start of CLI run.

Meta:

- `{ dryRun: boolean }`

### `cli:mako:ingestion:done`

Emitted once at end of CLI run.

Meta:

- `durationMs: number`
- `source: "mako-channel12"`
- `dryRun: boolean`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`

### `cli:mako:ingestion:error`

Emitted on error; then CLI exits with code `1`.

Meta:

- `durationMs: number`
- `error: unknown`

## Debugging playbook

### Validate scraper correctness

Look for:

- `ingestion:mako:scraped { count: 5 }`

If `count` is 0 or missing, inspect failures in:

- [Scraping](./Scraping.md)
- [Failure Modes](./FailureModes.md)

### Validate idempotency

Run ingestion twice (non-dry-run):

1st run: expect

- `newItemsCount > 0`
- `storedCount > 0`

2nd run: expect either

- `ingestion:mako:early-exit:no-new-items`

or

- `ingestion:mako:done` with `newItemsCount: 0`, `storedCount: 0`

### Validate persistence

Look for `storedCount` in:

- `ingestion:mako:done`
- `cli:mako:ingestion:done`
- `cron:mako:ingestion:done`

If `newItemsCount > 0` but `storedCount === 0`:

- suspect DB uniqueness collisions, or
- suspect repository errors masked elsewhere.

### Validate performance bottlenecks

The scraper uses a single `evaluateAll` extraction to reduce per-item delays.

If runs are still slow:

- check navigation timeouts (page load / bot protection)
- check DB I/O on slow disks
- check that you are not running headful with high slowMo

