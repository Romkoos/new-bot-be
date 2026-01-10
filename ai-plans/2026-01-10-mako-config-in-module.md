# Task: Move Mako env config into `news-ingestion` module (no `.env`/`.env.local` mako vars)

## Context
- Ticket/Request: ג€I don't want specific variables in `.env` or `.env.local`. Save the mako variables inside mako ingestion module.ג€
- Related docs:
  - `docs/Ingestion.md`
  - Root `README.md`

## Objective
- Remove mako-specific env var definitions from repo-root `.env` / `.env.local`.
- Centralize **env var keys + defaults + parsing** for Mako ingestion inside `src/modules/news-ingestion` and expose it via the module **Public API** (no deep imports).
- Keep behavior unchanged (still configurable via environment variables), but make `app/*` stop hardcoding env var names.

## Technical Approach
- Add a module-level config helper (exported from `src/modules/news-ingestion/public/index.ts`) that:
  - Defines the canonical `MAKO_*` env var keys
  - Parses env vars into a plain config object used by DI/cron
- Update:
  - `src/app/di/container.ts` to call the module config helper when constructing `PwMakoScraper`
  - `src/app/cron/makoIngestCron.ts` to read schedule via the module config helper
  - `src/app/cli/makoIngestCli.ts` to set the new `MAKO_*` env vars (not the legacy ones)
- Delete `.env` and `.env.local` from repo root (they are gitignored, but should not exist locally in this repo state per your request).
- Update docs/README to reference the module config (list env vars there) instead of suggesting `.env` content.

## Implementation Steps
- [x] Step 1: Create module config helper + export via `modules/news-ingestion/public`.
- [x] Step 2: Switch DI/cron/CLI to module config helper + new `MAKO_*` keys.
- [ ] Step 3: Remove repo-root `.env` / `.env.local` files from the workspace.
- [x] Step 4: Update docs/README references accordingly.
- [x] Step 5: `npm run build` + `npm test`.

## Files to Modify/Create
- `src/modules/news-ingestion/public/index.ts` - export config helper
- `src/modules/news-ingestion/application/MakoEnvConfig.ts` (or similar) - env keys/defaults/parsing
- `src/app/di/container.ts` - consume module config helper
- `src/app/cron/makoIngestCron.ts` - consume module config helper
- `src/app/cli/makoIngestCli.ts` - set new `MAKO_*` env keys
- `docs/Ingestion.md` - update env var guidance
- `README.md` - update env var guidance
- `.env` / `.env.local` - delete

## Testing Strategy
- [ ] `npm run build`
- [ ] `npm test`

## Rollback Plan
Revert the commit(s). Since env var fallbacks remain, rollback is safe.

## Open Questions
- None (we will keep DB `source` as `"mako-channel12"` unchanged).

## Completed
- Date completed: 2026-01-10
- Notes:
  - Mako env keys/defaults/parsing live in src/modules/news-ingestion/public/makoEnv.ts and are consumed via eadMakoConfig / MAKO_ENV.
  - .env/.env.local keep only generic runtime vars (PORT, NEWS_BOT_SQLITE_PATH).

