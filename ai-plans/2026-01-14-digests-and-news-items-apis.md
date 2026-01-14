# Task: Add Digests + News Items Read APIs

## Context
- Ticket/Request: Create 2 GET APIs:
  - List digests (all columns except: `source_items_count`, `source_news_texts_json`, `publisher_external_id`).
  - Fetch news items by an input array of string ids, returning items in the same order; include all columns except: `hash`, `payload_json`.
- Related docs:
  - `docs/Overview.md` (API entry-point rules)
  - `docs/Architecture.md` (orchestrators + ports/adapters boundaries)
  - `docs/system/DependencyInjection.md` (DI container wiring rules)
  - `docs/ingestion/Storage.md` (schema: `news_items`)
  - `docs/modules/publishing.md` (schema: `digests` + ownership)

## Objective
Add two **read-only** HTTP endpoints (Express) that expose safe subsets of SQLite tables:
- `digests`: return all digest columns except the excluded ones.
- `news_items`: accept ids and return corresponding news item rows (excluding sensitive columns), preserving input order.

## Technical Approach
- Keep `src/app/api/*` as infrastructure-only:
  - Parse/validate request shape.
  - Call exactly **one orchestrator** per endpoint.
  - Map DTOs to JSON response.
- Implement business/read concerns as orchestrators inside owning modules:
  - `publishing` module owns `digests` reads.
  - `news-ingestion` module owns `news_items` reads (table already defined + used by ingestion).
- Add dedicated **ports** for read operations to avoid leaking adapter details:
  - `DigestReadPort` implemented by `SqlitePublishingRepo`.
  - Extend `NewsItemsRepositoryPort` (or add `NewsItemsReadPort`) implemented by `SqliteNewsRepo`.
- Wire new orchestrators in `src/app/di/container.ts` and expose them on the `AppContainer`.

## Implementation Steps
- [ ] Step 0: Branch prep (per workflow)
  - Update `master`
  - Create a new branch from updated `master` (e.g. `feat/api-digests-news-items`)

- [x] Step 1: Publishing module — digests read use-case
  - Add port `src/modules/publishing/ports/DigestReadPort.ts`
  - Add DTO `src/modules/publishing/dto/DigestDto.ts` (excludes forbidden fields)
  - Add orchestrator `src/modules/publishing/application/ListDigestsOrchestrator.ts`
  - Implement in adapter `src/modules/publishing/adapters/SqlitePublishingRepo.ts`:
    - `listDigests(): Promise<ReadonlyArray<DigestDto>>`
    - SQL should select explicitly: `id, created_at, updated_at, digest_text, is_published, source_item_ids_json, llm_model, published_at`
      (omit `source_items_count`, `source_news_texts_json`, `publisher_external_id`)
    - Order: `ORDER BY id DESC` (or `created_at DESC`)
  - Export orchestrator + DTO/port from `src/modules/publishing/public/index.ts`

- [x] Step 2: News-ingestion module — news items by ids use-case
  - Add DTO `src/modules/news-ingestion/dto/NewsItemDto.ts` (excludes `hash`, `payload_json`)
  - Add orchestrator `src/modules/news-ingestion/application/GetNewsItemsByIdsOrchestrator.ts`
  - Add a read method to persistence boundary:
    - Option A (preferred for simplicity): extend `NewsItemsRepositoryPort` with:
      - `findByIds(ids: ReadonlyArray<number>): Promise<ReadonlyArray<NewsItemDto>>`
    - Adapter `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` implements it using a single query:
      - `SELECT id, source, raw_text, published_at, scraped_at, processed, media_type, media_url FROM news_items WHERE id IN (...)`
      - Orchestrator preserves input order by mapping `id -> row` and re-building output array in input order.
      - Orchestrator returns `null` for ids not found (keeps positional contract stable).
  - Export orchestrator + DTO from `src/modules/news-ingestion/public/index.ts`

- [x] Step 3: DI wiring
  - Update `src/app/di/container.ts`:
    - Instantiate `ListDigestsOrchestrator` with `SqlitePublishingRepo` as `DigestReadPort`.
    - Instantiate `GetNewsItemsByIdsOrchestrator` with `SqliteNewsRepo`.
    - Expose new orchestrators on the `AppContainer` type.

- [x] Step 4: API routes
  - Add `src/app/api/routes/digestsRoute.ts`
    - `GET /digests` → `container.publishing.listDigests.run()` (or similar) → JSON array.
  - Add `src/app/api/routes/newsItemsRoute.ts`
    - `GET /news-items/by-ids` (or `GET /news-items`)
    - Parse ids from query; validate:
      - reject empty list
      - reject non-integer ids
      - optional: enforce max ids (e.g. 200) to avoid huge `IN (...)`
    - Call orchestrator and return array (same length/order as input).
  - Register routes in `src/app/api/server.ts`:
    - `app.use(digestsRoute(container));`
    - `app.use(newsItemsRoute(container));`

- [x] Step 5: Tests (lightweight unit tests)
  - Add orchestrator unit tests with fake ports:
    - `src/modules/publishing/tests/ListDigestsOrchestrator.test.ts`
    - `src/modules/news-ingestion/tests/GetNewsItemsByIdsOrchestrator.test.ts`
  - Focus on:
    - ordering contract for ids
    - nulls for missing ids (if we choose that contract)

- [ ] Step 6: Documentation
  - Add `docs/api/README.md` describing the new endpoints (request/response shapes + examples).
  - Update `docs/README.md` to link the new API doc.

## Files to Modify/Create
- `src/modules/publishing/ports/DigestReadPort.ts` - new read port
- `src/modules/publishing/dto/DigestDto.ts` - public digest DTO (safe fields)
- `src/modules/publishing/application/ListDigestsOrchestrator.ts` - use-case
- `src/modules/publishing/adapters/SqlitePublishingRepo.ts` - implement read query
- `src/modules/publishing/public/index.ts` - export new contracts
- `src/modules/news-ingestion/dto/NewsItemDto.ts` - safe news item DTO
- `src/modules/news-ingestion/application/GetNewsItemsByIdsOrchestrator.ts` - use-case
- `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts` - add read method (if Option A)
- `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts` - implement read query
- `src/modules/news-ingestion/public/index.ts` - export new contracts
- `src/app/di/container.ts` - wire orchestrators + expose on container
- `src/app/api/routes/digestsRoute.ts` - HTTP endpoint
- `src/app/api/routes/newsItemsRoute.ts` - HTTP endpoint
- `src/app/api/server.ts` - register routes
- `docs/api/README.md` - endpoint documentation
- `docs/README.md` - link to new API docs

## Testing Strategy (if needed)
- [ ] `npm test` (Vitest) for new orchestrator unit tests.
- [ ] Manual smoke:
  - `npm run dev` then:
    - `GET /digests`
    - `GET /news-items/by-ids?ids=1,2,3`

## Rollback Plan
- Revert the branch / commits.
- Remove the two routes from `src/app/api/server.ts`.
- Remove the two orchestrators and port additions.

## Open Questions
- **IDs input for GET**: do you prefer
  - `GET /news-items/by-ids?ids=1,2,3` (comma-separated), or
  - `GET /news-items/by-ids?ids=1&ids=2&ids=3` (repeated param), or
  - `GET` with JSON body (non-standard; not recommended)?
  I can support both comma-separated + repeated query params.
- **Missing ids**: if an id is not found in `news_items`, should the response:
  - include `null` at that position (preserves positional mapping), or
  - return `404` / `400` error, or
  - omit missing items (breaks positional contract)?

