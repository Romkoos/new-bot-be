# Task: CLI-triggered content preparation for publication

## Context
- Ticket/Request: Create a new module responsible for preparing ingested news items for publication. At this stage it is invoked via CLI.
- Related docs:
  - `docs/Architecture.md` (orchestrators in `src/modules/*/application`; entry-points call orchestrators only).
  - `docs/ingestion/Orchestration.md` (flow ownership rules; entry-points stay thin).
  - `docs/ingestion/Storage.md` (SQLite adapter currently owns schema creation; no migrations folder).
  - `docs/modules/README.md` (module deep-dive expectations).

## Objective
Implement a new use-case that:
- Loads all rows from `news_items` that are **not processed**.
- Processes them via a dedicated **processor adapter** into a single collection (an array of strings).
- Persists the resulting object into a new table that tracks publication state (default: not published).
- Marks source `news_items` rows as processed **only if** processing + persistence succeed.
- Terminates the CLI process.

## Technical Approach
- Add a new module: `src/modules/content-preparation/` that **owns** the content preparation use-case.
- Implement a single orchestrator in `src/modules/content-preparation/application/PrepareContentOrchestrator.ts` that controls ordering:
  - load unprocessed news items -> process -> persist output -> mark processed -> return summary
- Ports & adapters (hexagonal):
  - Port: `ContentProcessorPort` (pure transformation; no DB).
  - Port: `ContentPreparationRepositoryPort` (SQLite reads/writes; schema init).
  - Adapter: `DefaultContentProcessor` (initial implementation that aggregates selected items into `string[]`).
  - Adapter: `SqliteContentPreparationRepo` that:
    - Ensures schema on startup (since this repo currently has no migrations).
    - Adds `news_items.processed` column if missing via `ALTER TABLE ... ADD COLUMN` (one-time, permanent change).
    - Creates a new table for prepared content with a `published` flag defaulting to `0`.
    - Performs the “persist prepared output + mark source rows processed” step in a single SQLite transaction.
- CLI entry-point:
  - `src/app/cli/prepareContentCli.ts` parses `--help`, builds container once, calls only the orchestrator, logs, then `process.exit(0|1)`.
- DI wiring:
  - Extend `src/app/di/container.ts` to wire the new module’s orchestrator and dependencies.

## Data model / schema (proposed)
### 1) `news_items` (existing)
- Add column:
  - `processed INTEGER NOT NULL DEFAULT 0`
- Add columns (no behavior changes yet; storage only):
  - `media_type TEXT NULL` (allowed values: `"video" | "image"`, or `NULL`)
  - `media_url TEXT NULL`

### 2) New table (name: `prepared_content`)
Minimum required fields:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `created_at TEXT NOT NULL` (ISO)
- `payload_json TEXT NOT NULL` (JSON string; includes the `string[]` output + metadata)
- `published INTEGER NOT NULL DEFAULT 0`

Additional fields (for traceability/debuggability):
- `source_items_count INTEGER NOT NULL`
- `source_item_ids_json TEXT NOT NULL` (JSON array of `news_items.id` used to produce this run)

## Prepared output format (strings include metadata)
- The processor output remains an array of strings.
- Each string will be a **JSON string** containing metadata + content, e.g.:
  - `id`, `source`, `hash`, `publishedAt`, `rawText`, `mediaType`, `mediaUrl`

## Implementation Steps
- [x] Step 1: Create module skeleton `src/modules/content-preparation/*` (DTOs, ports, orchestrator, public API).
- [x] Step 2: Implement `SqliteContentPreparationRepo`:
  - ensure `news_items.processed` exists (ALTER TABLE when missing)
  - ensure `news_items.media_type` and `news_items.media_url` exist (ALTER TABLE when missing)
  - create `prepared_content` table
  - implement read-unprocessed + transactional “insert run + mark processed”
- [x] Step 3: Implement `DefaultContentProcessor` adapter (strings include metadata) and wire into orchestrator.
- [x] Step 4: Wire into DI container and add CLI entry-point + scripts.
- [ ] Step 5: Add tests (Vitest):
  - happy path inserts prepared run and marks items processed
  - processor error: does not mark items processed
  - persistence error: does not mark items processed
- [ ] Step 6: Update docs:
  - add module doc `docs/modules/content-preparation.md`
  - update `docs/modules/README.md`
  - update `docs/ingestion/Storage.md` to include:
    - `processed` column semantics
    - `media_type` / `media_url` columns (storage-only for now)
  - update `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` write-path to include `media_type` / `media_url` (storage only; no other behavior changes)

## Files to Modify/Create
- `src/modules/content-preparation/application/PrepareContentOrchestrator.ts` - use-case flow and ordering.
- `src/modules/content-preparation/ports/ContentProcessorPort.ts` - processing interface.
- `src/modules/content-preparation/ports/ContentPreparationRepositoryPort.ts` - repository interface.
- `src/modules/content-preparation/dto/*` - request/response DTOs (e.g., `PrepareContentResult`).
- `src/modules/content-preparation/adapters/DefaultContentProcessor.ts` - initial processor implementation.
- `src/modules/content-preparation/adapters/SqliteContentPreparationRepo.ts` - SQLite adapter for schema + persistence.
- `src/modules/content-preparation/public/index.ts` - public exports (orchestrator + DTOs + port types only).
- `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` - add schema columns + include `media_type` / `media_url` in inserts (storage-only).
- `src/app/di/container.ts` - wire new module.
- `src/app/cli/prepareContentCli.ts` - CLI entry-point that calls orchestrator only.
- `package.json` - add `dev:cli:prepare` / `start:cli:prepare` scripts.
- `docs/modules/content-preparation.md` - module deep dive.
- `docs/modules/README.md` - add module link.
- `docs/ingestion/Storage.md` - reflect `news_items.processed` column (if applicable).

## Testing Strategy (if needed)
- [ ] Unit/integration-style tests using `:memory:` SQLite:
  - seed `news_items` with `processed=0` and `processed=1` rows
  - run orchestrator once and assert:
    - one `prepared_content` row inserted
    - only the previously-unprocessed rows are updated to `processed=1`
  - simulate processor failure and assert no updates are applied
  - simulate repository write failure and assert no source updates are applied

## Rollback Plan
- Revert commits and remove:
  - `src/modules/content-preparation/*`
  - CLI entry-point and DI wiring
  - SQLite schema evolution code
- If a deployed DB already has the new column/table, rollback keeps them unused (safe).

## Open Questions
- None.

