# Task: Fix PM2 boot sequence (remove autostart block, prevent parallel boot runs, respect module orchestration)

## Context
- Ticket/Request: “check the git history, undo chore/pm2-boot-sequence and make it work”.
- Git history:
  - `02cae92 chore(cron): add boot sequence on pm2 start` was merged into `main`.
  - A follow-up fix exists but did **not** land on `main`: `eed9327 fix(cron): prevent parallel runs on pm2 start; run on cron_restart`.
- Related docs:
  - `docs/system/Lifecycle.md` (cron lifecycle + boot-time ordering section)
  - `docs/ingestion/EntryPoints.md` (entry-point boundary rules)
  - `ai-plans/2026-01-14-pm2-boot-sequence.md` (original intent)

## Objective
Make PM2-based cron execution work end-to-end again:

- Cron apps must actually start and receive `cron_restart` restarts.
- On PM2 start (including reboot), run **one** deterministic startup sequence:
  - ingest → publishing
- Prevent parallel boot-time runs (i.e., the individual cron apps must not execute their jobs on the initial PM2 start).
- Keep periodic schedules unchanged: `cron_restart` remains the source of truth.
- Respect architecture rules:
  - `src/app/*` is infrastructure/entry points only.
  - The “what runs and in what order” flow must live in `src/modules/*/application` (orchestrator).

## Technical Approach
- Fix the immediate PM2 issue:
  - Remove `autostart: false` from cron apps in `ecosystem.config.cjs` so PM2 actually starts them and `cron_restart` works.
- Prevent parallel boot-time execution:
  - Add a small PM2 run-gate helper used by each cron entry point:
    - On initial PM2 start: skip the job (stay alive so `cron_restart` can restart it later).
    - On PM2 restarts (including `cron_restart`): run the job once per restart (current contract).
  - Implementation: parse PM2-provided metadata from environment (primary: `process.env.pm2_env` JSON `restart_time`; fallback to “run” if metadata is missing).
- Make boot-time ordering compliant with architecture:
  - Create a dedicated module orchestrator that owns the “ingest → publishing” sequence.
  - Keep `src/app/cron/bootSequence.ts` as a thin entry point that calls exactly one orchestrator.

## Implementation Steps
- [x] Step 1: Create a new module for the boot-time flow owner (recommended: `src/modules/news-pipeline/`).
- [x] Step 2: Implement `BootSequenceOrchestrator` in `src/modules/news-pipeline/application/` that runs health → ingest → publishing by calling other modules via their Public APIs.
- [x] Step 3: Wire the new orchestrator in `src/app/di/container.ts` and expose it via `src/modules/news-pipeline/public/index.ts`.
- [x] Step 4: Refactor `src/app/cron/bootSequence.ts` to call the new orchestrator (no cross-module sequencing in `app/`).
- [x] Step 5: Add `src/app/cron/pm2RunGate.ts` and apply it in:
  - `src/app/cron/newsIngestCron.ts`
  - `src/app/cron/publishingCron.ts`
- [x] Step 6: Update `ecosystem.config.cjs`:
  - Keep `cron:boot-sequence`
  - Remove `autostart: false` from the cron apps so PM2 scheduling works again
- [x] Step 7: Update docs to match the implementation:
  - `docs/system/Lifecycle.md` (boot-time ordering + cron lifecycle text)
  - Any other doc sections referencing `autostart: false`
- [x] Step 8: Add an npm script to tail logs for all cron apps (`pm2:logs:cron`).
- [x] Step 9: Smoke-test PM2 boot sequence end-to-end and adjust the run-gate if needed (validate cron apps do not run in parallel on initial start; do run on `cron_restart`).

## Files to Modify/Create
- `src/modules/news-pipeline/application/BootSequenceOrchestrator.ts` - own the boot-time flow.
- `src/modules/news-pipeline/public/index.ts` - module public API.
- `src/app/di/container.ts` - wire the orchestrator.
- `src/app/cron/bootSequence.ts` - call the orchestrator only.
- `src/app/cron/pm2RunGate.ts` - determine “run on this start?”.
- `src/app/cron/newsIngestCron.ts` - same.
- `src/app/cron/publishingCron.ts` - same.
- `ecosystem.config.cjs` - remove `autostart: false` from cron apps.
- `docs/system/Lifecycle.md` - update lifecycle + boot-time ordering description.

## Testing Strategy (if needed)
- [ ] `npm run build`
- [ ] PM2 smoke:
  - `pm2 start ecosystem.config.cjs`
  - Verify `cron:boot-sequence` runs once and exits.
  - Verify other cron apps are running but do **not** execute their job on the initial start.
  - Verify on `pm2 restart cron:news:ingest` (or on `cron_restart` tick) the ingestion job executes once.

## Rollback Plan
- Revert this branch.
- (If needed) revert `02cae92` on `main` to remove boot sequence + autostart behavior.

## Open Questions
- Should the boot sequence run on any `pm2 restart all`, or only cold boot? (PM2 doesn’t provide a reliable “reboot-only” signal; we can only key off “initial start vs restart” per-process.)

