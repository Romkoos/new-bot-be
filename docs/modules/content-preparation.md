# Module: `content-preparation`

## Purpose / scope

The `content-preparation` module owns the use-case of converting **unprocessed** ingested news items into a single “prepared content” payload ready for later publication.

At this stage, it is invoked via **CLI** only.

## Where it lives

- Module root: `src/modules/content-preparation/`
- Public API: `src/modules/content-preparation/public/index.ts`

## Ownership

The module owns one orchestrator:

- `PrepareContentOrchestrator`

## Public API (`src/modules/content-preparation/public/index.ts`)

Exports (contracts only):

- Orchestrator:
  - `PrepareContentOrchestrator`
- DTOs:
  - `PrepareContentResult`
  - `NewsItemToPrepare`
- Ports:
  - `ContentProcessorPort`
  - `ContentPreparationRepositoryPort`

Adapters are intentionally not exported. They are instantiated in DI.

## Orchestrator: `PrepareContentOrchestrator`

File:

- `src/modules/content-preparation/application/PrepareContentOrchestrator.ts`

### Responsibility (flow owner)

This orchestrator owns the full use-case ordering:

1. Load all rows from `news_items` where `processed = 0`.
2. Process them via `ContentProcessorPort` into a single `string[]` (strings include metadata).
3. Persist one row into `prepared_content` with `published = 0` by default.
4. Mark the source `news_items` rows as processed **only if** step 2 and 3 succeed.

### Logs

- `content:prepare:start`
- `content:prepare:early-exit:no-unprocessed-items`
- `content:prepare:done`

## Ports

### `ContentProcessorPort`

File:

- `src/modules/content-preparation/ports/ContentProcessorPort.ts`

Contract:

- `process(items): string[]`

Notes:

- Each string is a **JSON string** containing content + metadata (initial convention).

### `ContentPreparationRepositoryPort`

File:

- `src/modules/content-preparation/ports/ContentPreparationRepositoryPort.ts`

Contracts:

- `findUnprocessedNewsItems()`
- `persistPreparedContentAndMarkProcessed(input)`

Atomicity requirement:

- Persisting prepared content and marking source rows processed must happen atomically (single transaction).

## Storage

The module stores prepared output in a dedicated table:

- `prepared_content`

Required behavior:

- `published` defaults to `0` (not published).

Source rows are tracked via:

- `news_items.processed` (0/1)

## Runtime integration

### DI wiring

File:

- `src/app/di/container.ts`

Exposed as:

- `container.contentPreparation.prepare`

### CLI entry point

File:

- `src/app/cli/prepareContentCli.ts`

Behavior:

- calls the orchestrator once and exits explicitly
- logs `cli:content:prepare:*`

## Tests

File:

- `src/modules/content-preparation/tests/PrepareContentOrchestrator.test.ts`

What is tested:

- success path persists `prepared_content` and marks `news_items` as processed
- failures do not mark source rows processed

