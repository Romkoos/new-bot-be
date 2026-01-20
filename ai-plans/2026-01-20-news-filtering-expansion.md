# Task: Expand News Filtering (regex filters + filtered flag + digest behavior)

## Context
- Ticket/Request: Expand news filtering functionality:
  - Add `filtered` field to `news_items` (default `false` / `0`).
  - Create a separate `filters` table.
  - Create API endpoints to create, update, and delete filters.
  - Filtering uses regular expressions (Unicode-aware), e.g. `(?<![\p{L}\p{M}])[במלכו]?(?:ה)?משפח(?:ה|ות)(?![\p{L}\p{M}])`.
  - Each news item must be checked against all available filters; if any matches, mark `filtered = true`.
  - When building a digest: include only `filtered === false`, but **processed must still be updated for filtered items as well**.
- Related docs:
  - `docs/Architecture.md` (orchestrators + ports/adapters boundaries)
  - `docs/api/README.md` (API entry-point rules + endpoint documentation style)
  - `docs/ingestion/Storage.md` (schema evolution pattern for `news_items`)
  - `docs/modules/publishing.md` (digest publishing flow + current `processed` semantics)
  - `docs/system/DependencyInjection.md` (DI wiring rules)

## Objective
Implement regex-based filtering that:
- Persists filters in a dedicated SQLite `filters` table (CRUD via REST).
- Persists per-item derived state in `news_items.filtered` (0/1).
- Persists per-item traceability in `news_items.filters_ids` (JSON array of filter ids that matched).
- Ensures digest creation uses only unfiltered items, while filtered items are still marked `processed = 1` so they stop reappearing.

## Technical Approach
- **Schema**
  - Add `news_items.filtered INTEGER NOT NULL DEFAULT 0`.
  - Add `news_items.filters_ids TEXT NOT NULL DEFAULT '[]'` (JSON array of integers).
  - Add `filters` table (SQLite) with minimal admin-friendly fields:
    - `id INTEGER PRIMARY KEY AUTOINCREMENT`
    - `created_at TEXT NOT NULL`
    - `updated_at TEXT NOT NULL`
    - `name TEXT NOT NULL UNIQUE`
    - `pattern TEXT NOT NULL` (stored as raw regex source; compiled at runtime)
- **Module ownership**
  - Create a new module `news-filtering` to own filter CRUD + read operations.
  - Publishing flow (owner: `publishing` module) will call the `news-filtering` public API to load filters, then apply them to candidate `news_items`.
- **Regex handling**
  - Validate patterns on create/update by compiling via `new RegExp(pattern, "u")`.
  - Matching is done against `news_items.raw_text` using `.test(text)`.
  - NOTE: filters are “admin-provided”; we will not attempt to sandbox regex execution beyond compilation validation.
- **Digest behavior**
  - During a `PublishDigestOrchestrator` run:
    - Select all `processed = 0` items.
    - Load all filters.
    - For each item, if any filter matches:
      - set `filtered = 1`
      - set `filters_ids = '[...]'` (JSON array of matched filter ids, deterministic order)
      - mark `processed = 1` (immediately; they should never be digested)
    - Remaining items (`filtered = 0`) proceed through the existing digest pipeline.
    - If no remaining items, early-exit without creating a digest (but filtered items were already marked processed).

## Implementation Steps
- [x] Step 0: Branch prep (per workflow)
  - Update `master`
  - Create a new branch from updated `master` (e.g. `feat/news-filters`)

- [x] Step 1: Add DB schema support for `news_items.filtered`
  - Update `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`:
    - Add `filtered` column to `CREATE TABLE IF NOT EXISTS news_items (...)`
    - Add `ensureColumnExists` call for `filtered` with `DEFAULT 0`
    - Extend `DbNewsItemByIdRow` + `NewsItemDto` mapping to include `filtered: 0 | 1`
  - Update `src/modules/publishing/adapters/SqlitePublishingRepo.ts` similarly (it also ensures `news_items` exists).

- [x] Step 1b: Add DB schema support for `news_items.filters_ids`
  - Update `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`:
    - Add `filters_ids` column to `CREATE TABLE IF NOT EXISTS news_items (...)`
    - Add `ensureColumnExists` call for `filters_ids` with `DEFAULT '[]'`
    - Extend `DbNewsItemByIdRow` + `NewsItemDto` mapping to include `filters_ids`
      - Representation: store JSON in SQLite `TEXT`, but return `filters_ids` as `ReadonlyArray<number>` (parsed from JSON) or as a string (TBD; keep API consistent).
  - Update `src/modules/publishing/adapters/SqlitePublishingRepo.ts` similarly (it also ensures `news_items` exists).

- [x] Step 2: Create `news-filtering` module (filters table + CRUD orchestrators)
  - Create module skeleton:
    - `src/modules/news-filtering/public/index.ts`
    - `src/modules/news-filtering/application/*Orchestrator.ts`
    - `src/modules/news-filtering/ports/FiltersRepositoryPort.ts`
    - `src/modules/news-filtering/adapters/SqliteFiltersRepo.ts`
    - `src/modules/news-filtering/dto/FilterDto.ts`
  - Orchestrators:
    - `CreateFilterOrchestrator` (validates regex compilation)
    - `UpdateFilterOrchestrator` (validates regex compilation when pattern changes)
    - `DeleteFilterOrchestrator`
    - `ListFiltersOrchestrator` (**needed internally** for publishing to load “all available filters”)
  - Adapter ensures schema:
    - `CREATE TABLE IF NOT EXISTS filters (...)`
  - Result contract style:
    - Mirror publishing catalog pattern: `{ ok: true, value } | { ok: false, error }` for predictable API mapping.

- [x] Step 3: Publishing flow — apply filters and mark processed for filtered items
  - Extend publishing SQLite adapter with persistence-only helpers:
    - `markNewsItemsFiltered({ ids })` (set `filtered = 1` for ids)
    - `setNewsItemsFiltersIds({ idToFilterIds })` (set `filters_ids` JSON array per item)
    - `markNewsItemsProcessed({ ids })` (set `processed = 1` for ids)
    - (both must be no-ops on empty arrays)
  - Update `PublishDigestOrchestrator`:
    - Load unprocessed items via existing `NewsSelectionPort.findUnprocessedNewsTexts()`.
    - Load filters via `news-filtering` `ListFiltersOrchestrator`.
    - Partition ids into `filteredIds` vs `candidateIds`.
    - Persist flags:
      - set `filtered=1` for filteredIds
      - set `filters_ids` for filtered items (matched filter ids)
      - set `processed=1` for filteredIds
    - Continue digest using only candidates.
    - Keep existing behavior for candidates: they are marked processed only when the pending digest is persisted (atomic with digest insert).

- [x] Step 4: DI wiring
  - Update `src/app/di/container.ts`:
    - Instantiate `SqliteFiltersRepo`
    - Wire filter orchestrators under a new `container.filters` namespace
    - Inject `container.filters.listFilters` into `PublishDigestOrchestrator` (as a dependency)

- [x] Step 5: API endpoints
  - Add `src/app/api/routes/filtersRoute.ts`:
    - `POST /filters` (create)
    - `PUT /filters/:id` (update)
    - `DELETE /filters/:id` (delete)
    - (Optional but recommended) `GET /filters` (list) for admin usability and to obtain ids.
  - Register in `src/app/api/server.ts` under `/api`.

- [ ] Step 6: Tests
  - Unit tests in Vitest (no SQLite dependency):
    - Regex validation behavior (invalid regex rejected)
    - Publishing orchestrator filtering partition logic (using fake ports):
      - items matching any filter are excluded from digest input
      - filtered items are marked processed via the port

- [ ] Step 7: Docs update (mandatory)
  - Update `docs/api/README.md` with filter endpoints (request/response + examples).
  - Add a short section to `docs/modules/publishing.md` explaining:
    - `news_items.filtered` semantics
    - digest selection is `processed=0 AND filtered=0` (derived during run)
    - filtered items become `processed=1` immediately when detected

## Files to Modify/Create
- Modify:
  - `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` - add `filtered` column + mapping
  - `src/modules/news-ingestion/dto/NewsItemDto.ts` - include `filtered` field
  - `src/modules/publishing/adapters/SqlitePublishingRepo.ts` - add `filtered` column + mark helpers
  - `src/modules/publishing/application/PublishDigestOrchestrator.ts` - apply filters before digest
  - `src/app/di/container.ts` - wire new module + inject into publishing flow
  - `src/app/api/server.ts` - register filters route
  - `docs/api/README.md` - document new endpoints
  - `docs/modules/publishing.md` - document new filtering behavior
- Create:
  - `src/modules/news-filtering/**` - module skeleton, ports, DTOs, adapters, orchestrators
  - `src/app/api/routes/filtersRoute.ts` - REST endpoints
  - `src/modules/news-filtering/tests/*` (optional) and/or `src/modules/publishing/tests/*` updates

## Testing Strategy
- [ ] `npm test` (Vitest)
- [ ] Manual smoke (after wiring):
  - Create filter via API
  - Run digest flow (CLI or cron) and confirm:
    - matched items are not used as digest input
    - matched items become `processed=1` and `filtered=1`

## Rollback Plan
- Revert the branch / commits.
- Remove `/api/filters` route registration.
- Remove `news-filtering` module and `filtered` column migration additions.

## Open Questions
- Do you want filters to have a required **`name`** (human label), or should the API/table store only the regex **`pattern`**?
- Should we expose `GET /api/filters` (list) even though the request only mentions create/update/delete?
- Should filter matching run against only `raw_text`, or also include other fields (e.g. `source`, `media_url`) in the future?

