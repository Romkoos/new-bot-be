# Task: Replace in-process cron scheduling with PM2 scheduling

## Context
- Ticket/Request: Replace the current cron scheduling approach with PM2-based scheduling; remove in-process schedulers; keep business behavior the same.
- Related docs:
  - `docs/system/Lifecycle.md` (current cron lifecycle and responsibilities)
  - `docs/ingestion/EntryPoints.md` (ingestion cron entry point behavior + logs)
  - `docs/ingestion/Config.md` (ingestion schedule env keys/defaults)
  - `docs/modules/news-ingestion.md` (ingestion cron entry point reference)
  - `docs/modules/publishing.md` (publishing entry points and behavior)

## Objective
Move responsibility for *when* cron jobs run out of the Node.js runtime and into PM2, while keeping the exact same job logic and effects:

- Cron entry points must **not** schedule themselves via `node-cron` anymore.
- PM2 must be the **single source of truth** for schedules.
- Each existing cron job must still exist and run at the same frequency:
  - Ingestion: default every 5 minutes (`*/5 * * * *`) (currently configurable via `INGEST_CRON_SCHEDULE`)
  - Publishing: twice per hour (`0,30 * * * *`) (currently configurable via `PUBLISHING_CRON_SCHEDULE`)

## Technical Approach
- Keep the existing cron entry point files in `src/app/cron/` as the execution surface, but convert them from **in-process schedulers** into **PM2-restarted runners**:
  - On process start: build container, run the job **once**, log start/done/error exactly as today.
  - After the run: keep the process alive **without** implementing any time-based scheduling (no `node-cron`, no `setInterval`/`setTimeout`).
  - PM2 will restart the process on a cron schedule (`cron_restart`), so each restart triggers exactly one run.
- Add a minimal PM2 ecosystem config (no new libraries) that defines one PM2 “app” per cron entry point, each with:
  - `script`: the compiled `dist/app/cron/*.js` entry point
  - `cron_restart`: the cron expression matching today’s schedule
  - Optional env values for schedule strings for logging parity (must match `cron_restart` to avoid drift)
- Update docs to reflect that cron schedules are controlled by PM2 (not `node-cron`), while preserving the same responsibilities and log semantics.

## Implementation Steps
- [x] Step 1: Inventory current cron jobs and schedules and confirm they match docs/config defaults.
- [x] Step 3: Update `src/app/cron/newsIngestCron.ts` to run once on boot and not use `node-cron`.
- [x] Step 4: Update `src/app/cron/publishingCron.ts` to run once on boot and not use `node-cron`.
- [x] Step 5: Add PM2 ecosystem config with one app per cron job and matching `cron_restart` schedules.
- [x] Step 6: Update docs to reflect PM2-driven scheduling (no behavior changes).

## Files to Modify/Create
- `src/app/cron/newsIngestCron.ts` - remove `node-cron` scheduling; run once per PM2 restart; keep logs/effects.
- `src/app/cron/publishingCron.ts` - remove `node-cron` scheduling; run once per PM2 restart; keep logs/effects.
- `ecosystem.config.cjs` (new) - PM2 process definitions for cron entry points with `cron_restart`.
- `docs/system/Lifecycle.md` - update cron lifecycle section to describe PM2 scheduling instead of `node-cron`.
- `docs/ingestion/EntryPoints.md` - update scheduling description to PM2-driven (runner restarts).

## Testing Strategy (if needed)
- [ ] `npm run build` to ensure TypeScript compiles to `dist/`.
- [ ] Smoke-run each built cron entry point once (manually) to confirm it runs one job and then stays alive:
  - `node dist/app/cron/newsIngestCron.js`
  - `node dist/app/cron/publishingCron.js`
- [ ] Validate log event names and payload shapes remain unchanged for start/done/error.

## Rollback Plan
- Revert the changes to `src/app/cron/*.ts` back to `node-cron` scheduling.
- Remove `ecosystem.config.cjs`.
- Restore docs wording to `node-cron` scheduling.

## Open Questions
- Should `ecosystem.config.cjs` also define the API process, or only the cron processes? (This plan assumes **cron-only** to minimize scope.)
- Do you want the PM2 schedule expressions to be editable only in `ecosystem.config.cjs` (pure PM2 source of truth), or should we keep the env config keys (`INGEST_CRON_SCHEDULE`, `PUBLISHING_CRON_SCHEDULE`) purely for logging parity (set by PM2 env and matched to `cron_restart`)?

## Completed
- Date completed: 2026-01-14
- Deviations:
  - Adopted `exec_mode: "fork"`, `instances: 1`, and `time: true` in `ecosystem.config.cjs`.
  - Intentionally did **not** enable `max_memory_restart`, because it can trigger unscheduled restarts and therefore extra cron executions (behavior change).
- Follow-ups:
  - None.
