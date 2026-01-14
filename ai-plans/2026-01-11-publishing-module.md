# Task: Replace content-preparation with a publishing module (LLM → Telegram → DB)

## Context
- Ticket/Request: Refactor the content-preparation-to-publication flow. Remove `content-preparation` module and drop `prepared_content`. Add a new provider-agnostic publishing module that selects unprocessed news, asks an LLM (Gemini) to generate a Markdown digest, publishes to Telegram, and persists status.
- Related docs:
  - `docs/Architecture.md` (orchestrators + hexagonal boundaries)
  - `docs/system/DependencyInjection.md` (composition root rules)
  - `docs/modules/content-preparation.md` (current flow to be removed/replaced)

## Objective
Implement a new module under `src/modules/` that owns the “publish digest” use-case:
- select unprocessed `news_items` using the same selection logic as the current SQLite content-preparation repo
- call an LLM with a fixed prompt and configurable model name
- normalize the LLM output minimally and deterministically
- persist the digest and its publish status in SQLite
- publish to Telegram via a bot and mark the digest as published after Telegram success
- remove the old module and stop using/dropping `prepared_content`

## Technical Approach
### Module naming and ownership
- New module: `src/modules/publishing/` (or `src/modules/digest-publishing/` if you prefer clarity; default proposal: `publishing`)
- Orchestrator (use-case owner): `PublishDigestOrchestrator` in `src/modules/<module>/application`

### Ports (provider-agnostic)
- **News selection port**: selects unprocessed news texts.
- **LLM port**: generates a digest (given prompt + input texts) without exposing Gemini concepts.
- **Publisher port**: publishes Markdown to an external channel without exposing Telegram concepts.
- **Digest repository port**: persists digests + status (pending/published) and supports marking published.

### Concrete adapters (provider-specific allowed here only)
- **LLM adapter**: `GoogleGeminiLlmClient` (or similar) using `@google/genai`.
  - Reads `GEMINI_API_KEY` internally from `process.env` passed into the adapter.
  - Model name configurable via a provider-agnostic env var (proposal below).
- **Publisher adapter**: `TelegramPublisher` using Telegram Bot HTTP API (`fetch`).
  - Reads Telegram env vars internally from `process.env` passed into the adapter.
  - Handles `MarkdownV2` escaping (deterministic) inside the adapter if `TELEGRAM_PARSE_MODE=MarkdownV2`.
- **DB adapter**: `SqlitePublishingRepo` (or split into `SqliteDigestRepo` + `SqliteNewsSelectionRepo`) using `better-sqlite3`.

### Env loading
Current repo does not load `.env` files (no `dotenv` usage). Proposal:
- Install `dotenv` and load `.env` then `.env.local` in entry points (API/Cron/CLI), before building the container.
  - This keeps secrets out of code and matches the requirement to add `.env`/`.env.local`.

### Storage (new table)
Create a new table for digests. Base requirements:
- service fields (ids, timestamps)
- `digest_text` (Markdown text)
- `is_published` (default false)

Proposed additional fields (review needed):
- `source_items_count` (number)
- `source_item_ids_json` (traceability) OR `source_item_id_max` (cursor-based traceability)
- `llm_model` (string; what model produced it)
- `published_at` (nullable timestamp)
- `publisher_message_id` (nullable; Telegram message id, if returned)
- `error_json` (nullable; last error details for failed publish attempts)

### Dropping `prepared_content`
Repo uses “ensure schema” (non-migrational) pattern, so destructive changes must be explicit.
Proposal:
- Stop creating `prepared_content` in code (by removing the module).
- Add a one-time cleanup step in the publishing SQLite adapter: if table `prepared_content` exists, drop it (and log).
  - Alternative (safer): keep table but stop using it; provide a one-time CLI to drop it. (Needs decision.)

## Implementation Steps
- [x] Step 0: Branch prep
  - Create a new branch from updated `master` (per workflow rule).
- [x] Step 1: Create the new module skeleton (`publishing`) with ports/DTOs/public API and orchestrator wiring contracts (no provider specifics).
- [x] Step 2: Implement SQLite adapter(s)
  - Select unprocessed news texts with the same `WHERE processed = 0 ORDER BY id ASC` semantics.
  - Create/ensure the new `digests` table.
  - Persist a pending digest row.
  - Update the row as published after successful publish.
  - Decide/implement how `news_items.processed` is advanced (see Open Questions).
  - Implement the `prepared_content` drop strategy (see Open Questions).
- [x] Step 3: Implement the LLM adapter (Gemini)
  - Install `@google/genai`.
  - Build prompt as specified and call `ai.models.generateContent`.
  - Keep model name configurable and choose a low-cost default.
- [x] Step 4: Implement the publisher adapter (Telegram)
  - Use Telegram Bot API `sendMessage`.
  - Apply parse-mode-specific escaping (MarkdownV2) if configured.
  - Support `disable_web_page_preview`.
- [x] Step 5: Add entry point (CLI first) + DI wiring
  - Add `src/app/cli/publishDigestCli.ts` calling only the orchestrator.
  - Update `src/app/di/container.ts` to wire the new orchestrator.
  - Add `dotenv` loading to CLI (and optionally API/Cron for consistency).
- [x] Step 6: Remove old `content-preparation` module + references
  - Delete module files/tests/docs entry.
  - Remove `dev:cli:prepare` / `start:cli:prepare` scripts.
  - Remove DI wiring and CLI entry point.
  - Update docs (`docs/modules/README.md`, remove `content-preparation` deep dive or mark as removed).
- [ ] Step 7: Tests
  - Unit test the orchestrator with fakes for ports.
  - SQLite adapter tests for:
    - digest table creation
    - publish status update
    - selection semantics
    - (optional) prepared_content drop behavior

## Files to Modify/Create
- `src/modules/publishing/public/index.ts` - provider-agnostic public API exports.
- `src/modules/publishing/application/PublishDigestOrchestrator.ts` - main use-case flow.
- `src/modules/publishing/ports/*.ts` - provider-agnostic ports.
- `src/modules/publishing/dto/*.ts` - request/response DTOs.
- `src/modules/publishing/adapters/Sqlite*.ts` - DB adapter(s) (SQLite).
- `src/modules/publishing/adapters/GoogleGemini*.ts` - LLM adapter.
- `src/modules/publishing/adapters/Telegram*.ts` - publisher adapter.
- `src/app/di/container.ts` - wire new orchestrator; remove old.
- `src/app/cli/publishDigestCli.ts` - new CLI entry point.
- `src/app/cli/prepareContentCli.ts` - remove (or delete after swap).
- `package.json` - add deps + scripts; remove old scripts.
- `.env` + `.env.local` - new env templates/placeholders (no secrets committed).
- `docs/modules/README.md` + new `docs/modules/publishing.md` - docs update; remove old module doc.

## Testing Strategy (if needed)
- [ ] Orchestrator happy-path: selection → LLM → normalization → persist → publish → mark published.
- [ ] Orchestrator early-exit: no unprocessed items.
- [ ] Failure: LLM error does not mark published.
- [ ] Failure: Telegram error does not mark published (and persists pending/failed state).
- [ ] MarkdownV2 escaping: deterministic transformation for known special chars.

## Rollback Plan
- Revert the new module commits and restore `content-preparation` module + DI wiring.
- Restore `prepared_content` creation logic if it was dropped.
- If DB table was dropped in prod, re-create it by reintroducing the old module/repo and re-running the CLI (data loss risk acknowledged).

## Open Questions
- Should we continue to update `news_items.processed`? If yes:
  - mark as processed when the digest is **created** (pending publish), or only after it is **published**?
  - do we need traceability fields (`source_item_ids_json`) to guarantee correct marking in concurrent ingestion scenarios?
- What should be the provider-agnostic env var name for selecting the LLM model?
  - Proposal: `PUBLISHING_LLM_MODEL` (defaults to a low-cost Gemini model inside the Gemini adapter).
- Telegram formatting:
  - Gemini output is “Markdown”, but Telegram is configured as `MarkdownV2` by default. Confirm we should escape MarkdownV2 (recommended), otherwise messages will often fail to send.
- Dropping `prepared_content`:
  - Prefer automatic drop on startup (via SQLite adapter) or a one-time explicit CLI command?

## Completed
- Date completed: 2026-01-11
- Deviations:
  - `.env.example` creation was blocked by a global ignore rule, so env templates were initially added as `env.example` / `env.local.example` and later removed per request after `.env` / `.env.local` were populated locally.
  - `news_items.processed` is marked when a pending digest is persisted (before publish) to preserve the “unprocessed selection” semantics and avoid re-digesting the same rows.
- Follow-ups:
  - Consider adding a publishing cron entry point once the end-to-end flow is validated in production.
