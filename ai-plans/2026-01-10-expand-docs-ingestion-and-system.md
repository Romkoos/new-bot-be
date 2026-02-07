# Task: Expand documentation (Ingestion module + full system lifecycle)

## Context
- Ticket/Request: Expand ingestion documentation into a максимально detailed documentation set, describing all module processes and how ingestion participates in overall orchestration. Re-review all modules, orchestrators, contracts, and related components; split docs into multiple files and folders where justified.
- Related docs: `docs/README.md`, `docs/Overview.md`, `docs/Architecture.md`.

## Objective
- Replace the single `docs/Ingestion.md` surface with a **topic folder** that contains:
  - a clear overview entry doc
  - deep dives per subsystem concern (ports/adapters, scraping, hashing, storage, orchestration, lifecycle, failures)
- Add **system-level** docs that explain:
  - startup lifecycle (API/cron/CLI)
  - how the DI container wires orchestrators
  - module boundaries and public API contracts
  - how ingestion integrates into the overall runtime
- Ensure `docs/README.md` remains the single navigable table of contents, updated first.

## Technical Approach
- Create a new folder `docs/ingestion/` as the ingestion topic home.
- Keep `docs/Ingestion.md` as either:
  - a short “moved” stub pointing to `docs/ingestion/README.md`, **or**
  - delete it and update all links (preferred if no external links depend on it).
- Add a new folder `docs/modules/` for module deep dives (`news-ingestion`, `publishing`, etc.).
- Add a new folder `docs/system/` for end-to-end runtime lifecycle and orchestration.
- Use the documentation template consistently:
  - Purpose/scope
  - Where it lives (entry points / key files)
  - Step-by-step runtime flows (explicit branching)
  - Inputs/outputs & contracts
  - Side effects
  - Edge cases & failure modes
  - Extension points
  - Related docs

## Implementation Steps
- [x] Step 1: Update `docs/README.md` TOC to the new structure (do this first).
- [x] Step 2: Create ingestion topic folder and docs:
  - [x] `docs/ingestion/README.md` (entry doc + links to deep dives)
  - [x] `docs/ingestion/Orchestration.md` (use-case ownership, flow ordering, idempotency rules)
  - [x] `docs/ingestion/EntryPoints.md` (cron/CLI roles, lifecycle, schedules)
  - [x] `docs/ingestion/Config.md` (MAKO_* env vars via `MAKO_ENV` / `readMakoConfig`, plus generic `PORT`/`NEWS_BOT_SQLITE_PATH`)
  - [x] `docs/ingestion/Scraping.md` (Playwright flow, selectors, drawer click, first-5 selection, time parsing)
  - [x] `docs/ingestion/Hashing.md` (normalization rules, stable hashing contract, where it happens)
  - [x] `docs/ingestion/Storage.md` (SQLite schema, uniqueness, insertion behavior, payload_json semantics)
  - [x] `docs/ingestion/Observability.md` (log namespaces `ingestion:mako:*`, `cli:mako:*`, `cron:mako:*`, what each means)
  - [x] `docs/ingestion/FailureModes.md` (timeouts, bot protection, sqlite path issues, retries guidance)
- [x] Step 3: Add system lifecycle docs:
  - [x] `docs/system/Lifecycle.md` (API server start, cron scheduler start, CLI run, shutdown behavior)
  - [x] `docs/system/DependencyInjection.md` (container responsibilities, wiring rules, adapter selection)
- [x] Step 4: Add module deep dives:
  - [x] `docs/modules/README.md` (index of modules and their public APIs)
  - [x] `docs/modules/news-ingestion.md` (module map: ports/adapters/dto/orchestrator/public)
- [x] Step 5: Link hygiene:
  - [x] Delete `docs/Ingestion.md` and fix all references under `docs/`.
  - [x] Grep for old paths and update.
- [x] Step 6: Final review:
  - [x] Ensure docs match current code paths (selectors, env vars, log tags, DB schema).
  - [x] Ensure `docs/README.md` reading order is coherent.

## Files to Modify/Create
- `docs/README.md` - update reading order + links
- `docs/Ingestion.md` - deleted (replaced by `docs/ingestion/*`)
- `docs/ingestion/*` - new topic docs
- `docs/system/*` - lifecycle + DI deep dives
- `docs/modules/*` - module deep dives

## Testing Strategy (if needed)
- [x] Grep for broken internal links/old paths under `docs/`.
- [x] Spot-check referenced code locations are accurate.

## Rollback Plan
- Revert the docs commits on this branch.
- Restore `docs/Ingestion.md` if removed and re-add prior TOC link.

## Open Questions
- None.

## Completed
- Date completed: 2026-01-10

