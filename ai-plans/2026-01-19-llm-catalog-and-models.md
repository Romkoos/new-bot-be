# Task: LLM catalog + model registry (DB normalization + CRUD APIs)

## Context
- Ticket/Request: User request on 2026-01-19 (normalize LLM + model storage; config stores model id; config APIs still expose model name).
- Related docs:
  - `docs/modules/publishing.md` (current `llm_config` + publishing flow)
  - `docs/api/README.md` (current `/api/llm-config` contract)
  - Architecture rules (workspace): orchestrators in `src/modules/*/application`, routes in `src/app/api/routes` call orchestrators only.

## Objective
- Introduce two new SQLite tables:
  - `llms` (LLM providers: name + alias)
  - `llm_models` (models linked to an LLM)
- Seed initial data:
  - LLM: `gemini` with alias `Gemini`
  - Model: `gemini-2.0-flash-lite` linked to `gemini`
- Add REST APIs to create/update/delete:
  - LLMs
  - Models (each linked to an LLM)
- Update `llm_config` storage to persist **model id** instead of model name, while keeping `/api/llm-config` request/response exposing the **model name string** (as before).

## Technical Approach
- **Publishing module owns the feature**: the LLM/model registry is used by publishing configuration and text generation, so use-cases live in `src/modules/publishing/application/`.
- **SQLite schema evolution**: follow existing pattern (“ensure/extend schema on initialization”) used by `LlmConfigService` and `SqlitePublishingRepo`.
- Add a DB-specific service in publishing module (e.g. `LlmCatalogService`) to:
  - ensure `llms` + `llm_models` tables exist
  - seed initial records idempotently
  - provide CRUD operations used by orchestrators
- Update `LlmConfigService` to:
  - ensure/migrate `llm_config` to store `model_id`
  - join to `llm_models` when loading config so it returns `{ model: string }` (model name) to callers
  - accept `model` name in upsert input and resolve to `model_id` internally

## Implementation Steps
- [x] Step 1: Add LLM catalog storage
  - [x] Create `llms` + `llm_models` tables (idempotent)
  - [x] Seed `gemini` and `gemini-2.0-flash-lite`
- [x] Step 2: Migrate `llm_config` to store `model_id`
  - [x] Detect old schema (`model` column) and migrate data into new schema
  - [x] Keep public config shape unchanged (`model` is still a model name string)
- [x] Step 3: Add module orchestrators for CRUD
  - [x] LLMs: create/update/delete
  - [x] Models: create/update/delete (linked to LLM)
- [x] Step 4: Add API routes (entrypoints only)
  - [x] Wire new routes under `/api` in `src/app/api/server.ts`
  - [x] Validate request bodies/params (400 on validation errors)
- [x] Step 5: Update docs
  - [x] `docs/api/README.md` for new endpoints + clarify `llm_config` now stores model id but still exposes model name
  - [x] `docs/modules/publishing.md` for new tables and how config resolves model name
- [x] Step 6: Add tests (Vitest)
  - [x] Unit tests for schema migration + CRUD operations using a temporary SQLite file (avoids `:memory:` multi-connection pitfalls).

## Completed

- Date completed: 2026-01-19
- Deviations:
  - Added read endpoints for discovery: `GET /api/llms` and `GET /api/llms/:id/models`.
- Follow-ups:
  - Consider adding read/list endpoints (`GET /api/llms`, `GET /api/llm-models`) if/when a UI needs discovery.

## Files to Modify/Create
- `src/modules/publishing/application/LlmCatalogService.ts` - new DB-specific service for LLMs/models
- `src/modules/publishing/application/LlmConfigService.ts` - evolve schema + migrate + resolve model id/name
- `src/modules/publishing/application/*Orchestrator.ts` - new orchestrators for LLM/model CRUD
- `src/modules/publishing/public/index.ts` - export new orchestrators (Public API)
- `src/app/di/container.ts` - wire new orchestrators/services into container
- `src/app/api/routes/llmsRoute.ts` - HTTP routes for LLM CRUD
- `src/app/api/routes/llmModelsRoute.ts` - HTTP routes for model CRUD
- `src/app/api/server.ts` - mount the new routes under `/api`
- `docs/api/README.md` - document new endpoints + updated storage semantics
- `docs/modules/publishing.md` - document new tables and config model-id resolution
- `src/modules/publishing/tests/*` - new tests for catalog/migration behavior

## Testing Strategy (if needed)
- [ ] `npm test` (Vitest)
- [ ] Migration test: start from legacy `llm_config(model TEXT)` schema, run `LlmConfigService` init, verify it migrates to `model_id` and still returns model name in `loadOrThrow()`.
- [ ] CRUD tests: create/update/delete LLMs and models and verify constraints (uniqueness, FK integrity).

## Rollback Plan
- Revert the feature branch commit(s) (schema changes are auto-applied on service init).
- For local/dev DBs, delete `./data/news-bot.sqlite` to rebuild from scratch if needed.

## Open Questions
- Should `PUT /api/llm-config` **reject unknown model names** (requires model to exist in `llm_models`) or **auto-create** missing models (preserves legacy “free text” behavior)?
- When deleting an LLM/model, do we want **hard delete** with cascades, or **prevent deletion** if referenced by `llm_config`?
- Do you want read endpoints too (e.g. `GET /api/llms`, `GET /api/llms/:id/models`) for UI/ops, or strictly create/update/delete only?

