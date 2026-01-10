# Ingestion (topic): News ingestion

## Purpose / scope

This folder documents the **`news-ingestion` module** end-to-end, with a focus on:

- **What the ingestion use-case does** (business flow and ordering).
- **How ingestion participates in overall orchestration** (Cron/CLI entry points, DI wiring).
- **Where each responsibility lives** (orchestrator vs ports vs adapters).
- **Operational behavior** (logs, idempotency, failure modes).

This is a **deep dive**. For system-level architecture rules, start with:

- `docs/Overview.md`
- `docs/Architecture.md`

## What “ingestion” means in this system

In this repo, *ingestion* is a use-case that:

1. **Scrapes** the target page with a browser (Playwright).
2. **Normalizes** scraped content for stable hashing.
3. **Hashes** each normalized item deterministically (SHA-256).
4. **Filters** out already-ingested items (by hash).
5. **Stores** only new items in SQLite (dedup via UNIQUE(hash)).

The owner of the flow is a single orchestrator:

- `src/modules/news-ingestion/application/NewsIngestOrch.ts`

## Reading order (recommended)

1. [Orchestration](./Orchestration.md)
2. [Entry Points](./EntryPoints.md)
3. [Config](./Config.md)
4. [Scraping](./Scraping.md)
5. [Hashing](./Hashing.md)
6. [Storage](./Storage.md)
7. [Observability](./Observability.md)
8. [Failure Modes](./FailureModes.md)

## Where it lives (key files)

### Use-case orchestrator (business flow owner)

- `src/modules/news-ingestion/application/NewsIngestOrch.ts`

### Ports (contracts used by the orchestrator)

- Scraper port: `src/modules/news-ingestion/ports/NewsScraperPort.ts`
- Hasher port: `src/modules/news-ingestion/ports/NewsItemHasherPort.ts`
- Repository port: `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts`

### Adapters (infrastructure implementations)

- Playwright scraper: `src/modules/news-ingestion/adapters/PwMakoScraper.ts`
- SHA-256 hasher: `src/modules/news-ingestion/adapters/Sha256Hasher.ts`
- SQLite repository: `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`

### Module Public API

The **only allowed import surface** for this module:

- `src/modules/news-ingestion/public/index.ts`

This exports:
- Orchestrator(s) / entry functions
- DTOs
- Port types (if needed)
- Module config helper (`INGEST_ENV`, `readIngestionConfig`)

It does **not** export adapters. Adapters are instantiated only in DI.

### System participation (where ingestion is invoked)

Ingestion is triggered by entry-points that are infrastructure-only:

- Cron entry point: `src/app/cron/newsIngestCron.ts`
- CLI entry point: `src/app/cli/newsIngestCli.ts`
- Composition root / DI wiring: `src/app/di/container.ts`

