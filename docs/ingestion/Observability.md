# Observability (logs and how to debug ingestion)

## Purpose / scope

This document explains:

- Which log events exist for ingestion.
- What each event means and what metadata it contains.
- How to use logs to debug failures and to verify idempotency.

## Where it lives

- Orchestrator logs: `src/modules/news-ingestion/application/NewsIngestOrch.ts`
- Entry-point logs:
  - `src/app/cron/newsIngestCron.ts`
  - `src/app/cli/newsIngestCli.ts`
- Logger implementation: `src/shared/observability/logger.ts`

## Logger model

The repo uses a minimal `Logger` abstraction:

- `logger.info(message, meta?)` writes to stdout
- `logger.error(message, meta?)` writes to stderr

`meta` is JSON-stringified with a safe fallback when serialization fails.

## Log namespaces

We use a consistent namespace scheme:

- Use-case logs (orchestrator):
  - `ingestion:news:*`
- Cron entry point logs:
  - `cron:news:*`
- CLI entry point logs:
  - `cli:news:*`

## Orchestrator log events (`ingestion:news:*`)

### `ingestion:news:start`

Emitted at the start of `NewsIngestOrch.run(...)`.

Meta:

- `{ dryRun: boolean }`

### `ingestion:news:scraped`

Emitted after scraper returns.

Meta:

- `{ count: number }` (number of scraped items returned by scraper)

### `ingestion:news:filtered`

Emitted after hashing and filtering against existing hashes.

Meta:

- `source: string` (provided by the configured scraper adapter)
- `existingCount: number` (how many of the candidate hashes already existed in storage)
- `filteredOutCount: number` (how many were removed as duplicates)
- `newItemsCount: number` (how many remain to store)

### `ingestion:news:early-exit:no-new-items`

Emitted when `newItemsCount === 0`.

Meta:

- `{ source: string, durationMs: number }`

This is a **successful** run outcome.

### `ingestion:news:done`

Emitted at the end of the use-case (both dry-run and persisted runs).

Meta:

- `source: string`
- `dryRun: boolean`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`
- `durationMs: number`

## Cron log events (`cron:news:*`)

### `Cron scheduler started (news ingestion).`

Emitted once on cron process startup.

Meta:

- `{ schedule: string }`

### `cron:news:ingestion:start`

Emitted for each scheduled tick before orchestrator run.

Meta:

- `{ schedule: string }`

### `cron:news:ingestion:done`

Emitted for each tick after orchestrator run.

Meta:

- `durationMs: number`
- `source: string`
- `dryRun: false`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`

### `cron:news:ingestion:error`

Emitted on any exception thrown from orchestrator.

Meta:

- `durationMs: number`
- `error: unknown` (whatever was thrown)

## CLI log events (`cli:news:*`)

### `cli:news:ingestion:start`

Emitted once at start of CLI run.

Meta:

- `{ dryRun: boolean }`

### `cli:news:ingestion:done`

Emitted once at end of CLI run.

Meta:

- `durationMs: number`
- `source: string`
- `dryRun: boolean`
- `scrapedCount: number`
- `newItemsCount: number`
- `storedCount: number`

### `cli:news:ingestion:error`

Emitted on error; then CLI exits with code `1`.

Meta:

- `durationMs: number`
- `error: unknown`

## Debugging playbook

### Validate scraper correctness

Look for:

- `ingestion:news:scraped { count: 5 }`

If `count` is 0 or missing, inspect failures in:

- [Scraping](./Scraping.md)
- [Failure Modes](./FailureModes.md)

### Validate idempotency

Run ingestion twice (non-dry-run):

1st run: expect

- `newItemsCount > 0`
- `storedCount > 0`

2nd run: expect either

- `ingestion:news:early-exit:no-new-items`

or

- `ingestion:news:done` with `newItemsCount: 0`, `storedCount: 0`

### Validate persistence

Look for `storedCount` in:

- `ingestion:news:done`
- `cli:news:ingestion:done`
- `cron:news:ingestion:done`

If `newItemsCount > 0` but `storedCount === 0`:

- suspect DB uniqueness collisions, or
- suspect repository errors masked elsewhere.

### Validate performance bottlenecks

The scraper uses a single `evaluateAll` extraction to reduce per-item delays.

If runs are still slow:

- check navigation timeouts (page load / bot protection)
- check DB I/O on slow disks
- check that you are not running headful with high slowMo

