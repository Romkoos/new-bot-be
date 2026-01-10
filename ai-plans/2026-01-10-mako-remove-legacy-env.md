# Task: Remove legacy Mako env vars (keep only `MAKO_*`)

## Context
- - Ticket/Request: "remove MAKO_ENV_LEGACY usages"
- Related docs:
  - `docs/Ingestion.md`
  - Root `README.md`

## Objective
- Stop supporting legacy env var names (keep only `MAKO_*`).
- Remove `MAKO_ENV_LEGACY` and all fallback reads in code, comments, and docs.
- Keep only canonical `MAKO_*` variables.

## Technical Approach
- `src/modules/news-ingestion/public/makoEnv.ts`
  - Delete `MAKO_ENV_LEGACY`.
  - Make `readMakoConfig` read only `MAKO_*` keys (with defaults where appropriate).
- `src/modules/news-ingestion/public/index.ts`
  - Stop exporting `MAKO_ENV_LEGACY`.
- Update remaining references in:
  - `src/app/di/container.ts` (remove old fallbacks once DI is switched to `readMakoConfig` in the next step)
  - `src/app/cron/makoIngestCron.ts`, `src/app/cli/makoIngestCli.ts`
  - `docs/Ingestion.md`, root `README.md`
  - plan files under `ai-plans/` (rename mentions for accuracy)

## Implementation Steps
- [x] Step 1: Remove `MAKO_ENV_LEGACY` + fallback logic from `makoEnv.ts` and stop exporting it.
- [x] Step 2: Update CLI/cron/DI to use only `MAKO_*` vars.
- [x] Step 3: Update docs and plan files to remove legacy env mentions.
- [x] Step 4: `npm run build` + `npm test`.

## Files to Modify/Create
- `src/modules/news-ingestion/public/makoEnv.ts`
- `src/modules/news-ingestion/public/index.ts`
- `src/app/di/container.ts`
- `src/app/cron/makoIngestCron.ts`
- `src/app/cli/makoIngestCli.ts`
- `docs/Ingestion.md`
- `README.md`
- `ai-plans/*.md` (text updates only)

## Testing Strategy
- [x] `npm run build`
- [x] `npm test`

## Rollback Plan
Revert commits on the task branch.

## Completed
- Date completed: 2026-01-10



