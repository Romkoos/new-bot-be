# Task: Rename Mako env/log naming (`MAKO_*` canonical)

## Context
- Ticket/Request: Rename all env vars/log tags/comments/docs that contain `mako_channel12` / `MAKO_CHANNEL12` to `mako` / `MAKO`.
- Related docs:
  - `docs/Ingestion.md`
  - Root `README.md`

## Objective
Make naming consistent by using:
- Env vars: `MAKO_*` (e.g. `MAKO_LOCALE`)
- Log tags from `*:mako-channel12:*` ג†’ `*:mako:*`
- Docs/comments accordingly

Preserve runtime behavior. Legacy env names are removed (canonical: `MAKO_*` only).

## Technical Approach
- **Env vars**: Read only `MAKO_*` vars (env parsing lives in module config; `app/*` must not hardcode env names).
- **CLI overrides**: Update `src/app/cli/makoIngestCli.ts` to set `MAKO_SCRAPER_HEADLESS` / `MAKO_SCRAPER_SLOWMO_MS` (and not the old names).
- **Cron schedule**: Update `src/app/cron/makoIngestCron.ts` to use `MAKO_CRON_SCHEDULE`.
- **Logs**: Replace `mako-channel12` log namespace in orchestrator/CLI/cron with `mako`.
- **Docs**: Update `docs/Ingestion.md` and root `README.md` env var names and log mentions.
- **Note (data contracts)**: Keep the storage/source identifier (`"mako-channel12"`) unchanged to avoid changing hashes/deduplication semantics and existing DB rows. This is internal and not user-facing config/log naming.

## Implementation Steps
- [x] Step 1: Update env var names in DI + add fallback aliases (new first, old fallback).
- [x] Step 2: Update CLI + cron to use new env var names.
- [x] Step 3: Update orchestrator/entrypoint log tags to `mako`.
- [x] Step 4: Update docs (`docs/Ingestion.md`, root `README.md`) to new env var names.
- [x] Step 5: Update tests affected by log tag rename.

## Files to Modify/Create
- `src/app/di/container.ts` - consume module config (`readMakoConfig`)
- `src/app/cli/makoIngestCli.ts` - set `MAKO_SCRAPER_*` env overrides
- `src/app/cron/makoIngestCron.ts` - read `MAKO_CRON_SCHEDULE`
- `src/modules/news-ingestion/application/MakoIngestOrch.ts` - rename log tags to `ingestion:mako:*`
- `src/modules/news-ingestion/tests/MakoIngestOrch.test.ts` - adjust assertions for log tags
- `docs/Ingestion.md` - rename env var docs (no filename changes)
- `README.md` - rename env var docs (no filename changes)
- `.env` / `.env.local` - keep generic vars only (no mako vars)

## Testing Strategy (if needed)
- [ ] `npm test`
- [ ] `npm run dev:cli:mako:dry-run` (sanity)

## Rollback Plan
Revert the commit(s) on the task branch. Since we keep env var fallbacks, rollback is low-risk.

## Open Questions
- Should we also rename the persisted `source` value from `"mako-channel12"` ג†’ `"mako"`? (This would require a data migration and careful handling to avoid breaking deduplication.)

## Completed
- Date completed: 2026-01-10

