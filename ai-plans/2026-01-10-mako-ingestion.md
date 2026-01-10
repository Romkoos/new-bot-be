# Task: Cron-triggered Mako Channel 12 news ingestion (scrape ' hash ' filter ' store)

## Context
- Ticket/Request: Implement a cron-triggered, idempotent news ingestion flow for `https://www.mako.co.il/news-channel12`.
- Related docs:
  - `docs/Overview.md` (entry-points call orchestrators only; DI container is composition root).
  - `docs/Architecture.md` (orchestrators in `src/modules/*/application`; ports/adapters; no business logic in `src/app/*`).

## Objective
On a configurable schedule, the system must:
1) Load the mako news page (browser-based scraper).
2) Extract the 5 most recent news items (first 5 items in DOM order).
3) Generate stable hashes for each item (based on normalized content).
4) Filter out items already stored (by hash).
5) Persist only new items in SQLite (single table, unique hash).
6) Log the full flow in a debuggable way (counts + timings + early-exit).

Re-running the job must not create duplicates.

## Technical Approach
- Add a dedicated module that **owns the use-case**:
  - Module: `src/modules/news-ingestion/`
  - Orchestrator (single place for full flow): `MakoIngestOrch`
  - Flow: scrape (port) ' hash (hasher port) ' filter (repo port read) ' store (repo port write; skipped in dry-run)

- Public API rule (must be enforced explicitly):
  - `src/modules/*/public/index.ts` exports **only public contracts**:
    - orchestrator(s)
    - DTOs
    - port types/interfaces (if needed by app/tests)
  - `public/index.ts` must **not** export adapters or adapter factories.
  - Adapter instantiation happens **only** in the DI container / composition root (`src/app/di/container.ts`).

- Keep the scraper pure infrastructure:
  - Port: `MakoScraperPort`
  - Adapter: Playwright-based scraper that:
    - navigates to `https://www.mako.co.il/news-channel12`
    - waits until page is loaded
    - extracts `.desktop-drawer-news .mc-extendable-text__content > div > div` items
    - takes the **first 5** (DOM order)
    - extracts:
      - main text/teaser
      - optional time from `.mc-message-footer__time` (HH:mm), uses **today** for date, returns ISO
    - returns normalized payload only (no hashing, no DB).

- Treat hashing as a dedicated responsibility (not an inline orchestrator utility):
  - Port: `NewsItemHasherPort`
  - Adapter: `Sha256Hasher` (or similar) that computes a stable hash from normalized content.
  - Rule: the orchestrator coordinates hashing, but does not define/own the hashing algorithm.
  - Hash stability rule (must be enforced explicitly):
    - Before hashing, minimally normalize:
      - trim strings
      - collapse whitespace
      - ensure `published_at` is consistently an ISO string or `null`
    - Hash must be computed from the normalized representation (canonical string/JSON) so identical content always produces the same hash.

- Add SQLite persistence as an adapter (no business rules):
  - Port: `NewsItemsRepositoryPort`
  - Adapter: SQLite repository for a single table `news_items` with columns:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `source TEXT`
    - `hash TEXT UNIQUE`
    - `raw_text TEXT`
    - `published_at TEXT NULL`
    - `scraped_at TEXT` (ISO now, set by adapter)
    - `payload_json TEXT`
  - Repository supports:
    - `findExistingHashes(hashes)` (read-only)
    - `insertMany(items)` (writes; orchestrator only calls this when not dry-run)
  - Enforce idempotency with:
    - orchestration-level filtering by existing hashes
    - DB-level `UNIQUE(hash)` as a safety net.

- Observability:
  - Use the existing shared `Logger` (`src/shared/observability/logger.ts`) directly (no additional LoggerPort).
  - Log at least:
    - ingestion start
    - scraped count
    - filtered/new count
    - stored count (or would-store in dry-run)
    - early exit when 0 new items
    - total execution time
  - Cron entry-point logs start + completion and triggers orchestrator only.

- Entry-points:
  - Cron: `src/app/cron/makoIngestCron.ts` schedules and calls the orchestrator.
  - Manual trigger (CLI): `src/app/cli/makoIngestCli.ts` runs once and supports `--dry-run`.
  - Both reuse the exact same orchestrator instance from the DI container.

## Configuration (proposed)
- `MAKO_CRON_SCHEDULE`:
  - default: `*/5 * * * *` (every 5 minutes) unless overridden
- `NEWS_BOT_SQLITE_PATH`:
  - default: `./data/news-bot.sqlite`

## Implementation Steps
- [x] Step 1: Create module skeleton `src/modules/news-ingestion/*` (ports, DTOs, orchestrator, public API).
- [x] Step 2: Implement Playwright scraper adapter (no hashing, no DB) behind `MakoScraperPort`.
- [x] Step 3: Implement hashing behind `NewsItemHasherPort` (stable, based on normalized content) and wire into orchestrator.
- [x] Step 4: Implement SQLite repository adapter behind `NewsItemsRepositoryPort` (table init + reads + inserts).
- [x] Step 5: Wire dependencies in `src/app/di/container.ts` (explicit DI; no adapter creation elsewhere).
- [x] Step 6: Complete the use-case flow in the orchestrator (filter existing hashes, persist new items, dry-run mode, debuggable logs + early-exit).
- [x] Step 7: Add cron entry-point `src/app/cron/makoIngestCron.ts`:
  - reads schedule from env
  - logs start/completion
  - calls orchestrator only
- [x] Step 8: Add CLI entry-point `src/app/cli/makoIngestCli.ts` with `--dry-run` (no DB writes).
- [x] Step 9: Add/update tests (Vitest) for the orchestrator:
  - stable hashing
  - filtering behavior
  - dry-run skips persistence but still logs counts
- [x] Step 10: Add/update docs under `docs/` describing the ingestion flow and configuration.
- [x] Step 11: Update scripts in `package.json` (dev cron + manual run) and dependencies (Playwright + SQLite client).
- [x] Step 12: Mark plan steps complete, add `## Completed`, commit(s) referencing this plan, and push branch.

## Files to Modify/Create
- `src/modules/news-ingestion/application/MakoIngestOrch.ts` - single owned use-case flow.
- `src/modules/news-ingestion/ports/MakoScraperPort.ts` - scraper port interface.
- `src/modules/news-ingestion/ports/NewsItemHasherPort.ts` - hashing port interface.
- `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts` - repository port interface.
- `src/modules/news-ingestion/dto/*` - normalized scrape payload + persisted record shapes.
- `src/modules/news-ingestion/adapters/PwMakoScraper.ts` - browser-based scraping implementation.
- `src/modules/news-ingestion/adapters/Sha256Hasher.ts` - stable hashing implementation.
- `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` - SQLite storage implementation.
- `src/modules/news-ingestion/public/index.ts` - public exports for orchestrator + DTOs + port types only (no adapters, no adapter factories).
- `src/app/di/container.ts` - add wiring for the new module orchestrator + ports.
- `src/app/cron/makoIngestCron.ts` - cron entry-point (thin).
- `src/app/cli/makoIngestCli.ts` - manual trigger entry-point with `--dry-run`.
- `package.json` - add scripts and dependencies for Playwright + `better-sqlite3`.
- `docs/README.md` - add link(s) to ingestion documentation.
- `docs/Overview.md` and/or new `docs/Ingestion.md` (or `docs/ingestion/MakoChannel12.md`) - document end-to-end runtime flow and config.
  - Include the Playwright browser binaries requirement and one-time install command: `npx playwright install` (do not auto-run).

## Testing Strategy (if needed)
- [x] Unit tests (Vitest) for orchestrator with mocked ports:
  - scrape returns N items (including duplicates) ' hashes stable and deterministic
  - repo returns existing hashes ' filtering correct
  - dry-run: `insertMany` not called, but would store count logged/returned
- [x] Manual smoke:
  - run CLI once in dry-run mode, verify logs + no DB file changes
  - run CLI without dry-run twice, verify second run stores 0 new items

## Rollback Plan
- Revert commits on branch `feature/mako-channel12-ingestion` and delete newly added module + entry-point files.
- Remove the newly added dependencies and scripts from `package.json`.

## Open Questions
- None.

## Completed
- Date completed: 2026-01-10
- Deviations:
  - Item selection uses **first 5 items in DOM order** (per clarified requirement).
  - Log namespace is **`mako`** (e.g. `ingestion:mako:*`), while the persisted `source` id stays `"mako-channel12"` for backwards compatibility with existing DB data.
- Follow-ups:
  - Consider ignoring local DB artifacts in git (e.g. `data/*.sqlite`) if not already ignored.


