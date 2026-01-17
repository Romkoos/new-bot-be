# Task: DB-driven Gemini LLM config (model + instructions)

## Context
- Ticket/Request: Move Gemini LLM configuration (model + instructions) out of hardcoded code and make it fully database-driven.
- Related docs:
  - `docs/modules/publishing.md` (publishing flow + current env var note for model)
  - `docs/api/README.md` (API conventions + existing endpoints)
  - `docs/ingestion/Storage.md` (SQLite schema is ensured by adapters on init)

## Objective
Replace all hardcoded Gemini model + prompt instructions with a single SQLite-backed config row.

Deliverables:
- SQLite table `llm_config` (single-row table with `id = 1`)
- Runtime loads `model` + `instructions` from DB before calling Gemini
- Fatal error when table has no row
- Minimal REST API: `GET /api/llm-config`, `PUT /api/llm-config`
- Mandatory migration step: seed DB with the **current** model + instructions (via an actual INSERT), and remove those values from code

## Technical Approach
- Introduce one small DB-backed service in publishing module to load/update LLM config: `LlmConfigService`.
- Keep `app/*` as entry-points only:
  - Add route `llmConfigRoute` under `src/app/api/routes/` that calls publishing orchestrators.
- Keep publishing orchestrator unaware of DB specifics:
  - `PublishDigestOrchestrator` depends on `LlmConfigService` and uses it to get `{model, instructions}`.
- Remove provider defaults:
  - `GoogleGeminiTextGenerator` will no longer read model from env or hardcode a default.
  - The model is passed per call from the DB config.
- Add a SQL migration file that creates `llm_config` and inserts the **current** hardcoded values.
  - This keeps runtime free of defaults, while still ensuring DB is seeded “from the first run”.

## Implementation Steps
- [x] Step 1: Add SQL migration file to create `llm_config` and insert the current model + instructions (single row with `id=1`).
- [x] Step 2: Add `LlmConfigService` that:
  - ensures `llm_config` table exists
  - loads row `id=1` (fatal error if missing)
  - validates `model` + `instructions` are non-empty strings (invalid => return `{ ok:false }` for callers to skip execution)
  - upserts row on API `PUT` and updates `updated_at`
- [x] Step 3: Wire publishing:
  - Update `TextGenerationPort` to accept `model` in `generateText` input
  - Update `GoogleGeminiTextGenerator` to require per-call `model` (no env/defaults)
  - Update `PublishDigestOrchestrator` to:
    - load config via `LlmConfigService` before Gemini call
    - build prompt as `instructions + "\\n" + JSON.stringify(newsTexts)`
    - if config invalid, log and early-exit (skip execution)
    - if config missing row, throw (fatal)
- [x] Step 4: Add publishing orchestrators for the API:
  - `GetLlmConfigOrchestrator` returns current config
  - `UpsertLlmConfigOrchestrator` validates non-empty strings and updates/creates row
- [x] Step 5: Add API route:
  - `GET /api/llm-config`
  - `PUT /api/llm-config` with body `{ model, instructions }`
- [x] Step 6: DI wiring:
  - Instantiate `LlmConfigService` in `src/app/di/container.ts`
  - Add `publishing.getLlmConfig` and `publishing.upsertLlmConfig` orchestrators to the container
- [x] Step 7: Documentation updates:
  - Update `docs/api/README.md` to document the new endpoints
  - Update `docs/modules/publishing.md`:
    - remove `PUBLISHING_LLM_MODEL` env var mention
    - document DB-driven config and failure mode

## Completed
- Date completed: 2026-01-17
- Deviations: None.
- Follow-ups: None.

## Files to Modify/Create
- `migrations/2026-01-17-llm-config.sql` - create `llm_config` and seed the single row with the current model + instructions
- `src/modules/publishing/application/LlmConfigService.ts` - DB-backed config loader/upserter
- `src/modules/publishing/application/GetLlmConfigOrchestrator.ts` - read API use-case
- `src/modules/publishing/application/UpsertLlmConfigOrchestrator.ts` - update API use-case
- `src/modules/publishing/ports/TextGenerationPort.ts` - accept `model` per call
- `src/modules/publishing/adapters/GoogleGeminiTextGenerator.ts` - remove env/default model usage; use provided model
- `src/modules/publishing/application/PublishDigestOrchestrator.ts` - remove hardcoded instructions; load config; skip/fail per requirements
- `src/app/di/container.ts` - wire new service + orchestrators
- `src/app/api/server.ts` - add `llmConfigRoute`
- `src/app/api/routes/llmConfigRoute.ts` - new minimal endpoints
- `docs/api/README.md` - document endpoints
- `docs/modules/publishing.md` - update configuration docs

## Testing Strategy (if needed)
- [ ] Start API (`npm run dev`) and call:
  - GET `/api/llm-config` returns row
  - PUT `/api/llm-config` updates row and `updated_at`
- [ ] Run publishing CLI (`npm run dev:cli:publish`) with:
  - valid config row => publishes/creates digest as before
  - missing row => process throws fatal error
  - invalid row (empty strings) => orchestrator logs and exits early without Gemini call

## Rollback Plan
- Revert this branch (single PR).
- DB rollback (if needed): `DROP TABLE llm_config;` (or restore from backup).

## Open Questions
- None. All requirements are specific; “missing row” will be treated as fatal, while “invalid values” will cause a safe early-exit (skip execution).

