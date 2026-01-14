# Task: Run cron jobs once on PM2/system start in strict sequence

## Context
- Ticket/Request: On system (or PM2) start, run cron jobs once in strict sequence: health → ingest → publishing. Must work after VM reboot.
- Related docs:
  - `docs/system/Lifecycle.md` (cron lifecycle)
  - `ecosystem.config.cjs` / `ecosystem.config.js` (PM2 scheduling source of truth)

## Objective
When PM2 starts (including after VM reboot), the system must execute one “startup run” of the existing cron jobs in the strict order:

1. health
2. ingest
3. publishing

Constraints:
- Do not reintroduce in-process time scheduling (no `node-cron`, no timers as schedulers).
- Keep existing business logic unchanged (orchestrators unchanged).
- Keep the periodic schedules unchanged (PM2 `cron_restart` remains the source of truth).

## Technical Approach
- Add a **boot sequence entry point** that runs the three existing jobs once in-order and then exits:
  - `src/app/cron/bootSequence.ts` (new)
  - Uses the DI container and calls the existing orchestrators.
  - Emits the same log event names/payload shapes as the existing cron entry points for consistency.
- Prevent the individual cron processes from executing their jobs immediately on the **initial PM2 start**, to avoid parallel execution at boot:
  - In each cron entry point (`healthCron.ts`, `newsIngestCron.ts`, `publishingCron.ts`), detect “first PM2 start” vs “PM2 restart”.
  - When it’s the first start, **do not run the job**; just idle so PM2 `cron_restart` can restart it later.
  - On PM2 restarts (including `cron_restart`), run once per restart as before.
- Update PM2 ecosystem config to include the boot sequence process:
  - Add a new PM2 app `cron:boot-sequence` with no `cron_restart` and `autorestart: false` so it runs once at PM2 start.

## Implementation Steps
- [x] Step 1: Confirm how to detect first-start vs restart under PM2 in this environment (PM2 env injection).
- [ ] Step 2: Add `src/app/cron/bootSequence.ts` to run health → ingest → publishing once and exit.
- [ ] Step 3: Update `src/app/cron/healthCron.ts` to skip immediate run on first PM2 start (idle only).
- [ ] Step 4: Update `src/app/cron/newsIngestCron.ts` to skip immediate run on first PM2 start (idle only).
- [ ] Step 5: Update `src/app/cron/publishingCron.ts` to skip immediate run on first PM2 start (idle only).
- [ ] Step 6: Update `ecosystem.config.cjs` to add the boot sequence PM2 app (and keep existing schedules unchanged).
- [ ] Step 7: Update `docs/system/Lifecycle.md` to document the boot sequence behavior and the “idle on first start” rule.

## Files to Modify/Create
- `src/app/cron/bootSequence.ts` (new) - run once on PM2/system start: health → ingest → publishing.
- `src/app/cron/healthCron.ts` - skip job on initial PM2 start; run on restarts; keep idle behavior for `cron_restart`.
- `src/app/cron/newsIngestCron.ts` - same pattern.
- `src/app/cron/publishingCron.ts` - same pattern.
- `ecosystem.config.cjs` - add `cron:boot-sequence` app (no `cron_restart`).
- `docs/system/Lifecycle.md` - document startup sequencing.

## Testing Strategy (if needed)
- [ ] `npm run build`
- [ ] `pm2 start ecosystem.config.js` and verify:
  - `cron:boot-sequence` runs once and logs in the required order.
  - Other cron apps start but do not execute their jobs on first start.
- [ ] `pm2 restart cron:news:ingest` (or wait for `cron_restart`) and verify it runs once on restart.

## Rollback Plan
- Remove `cron:boot-sequence` app and `src/app/cron/bootSequence.ts`.
- Restore cron entry points to run-on-start behavior.

## Open Questions
- Should the boot-sequence run on **any** `pm2 restart all` (manual), or only on cold starts after reboot? PM2 does not provide a clean “reboot-only” signal; this plan runs on any PM2 start/restart that starts the boot-sequence app.

