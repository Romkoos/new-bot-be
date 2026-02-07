# Task: Run publishing digest cron every 3 hours

## Context
- Ticket/Request: Change `cron:publishing:digest` to run every 3 hours.
- Related docs:
  - `docs/system/Lifecycle.md` (PM2 owns cron scheduling via `cron_restart`).
  - `docs/ingestion/EntryPoints.md` (pattern for documenting cron schedule config).
  - `docs/modules/publishing.md` (publishing module + entry points).

## Objective
Update the PM2 schedule so `cron:publishing:digest` runs **every 3 hours** (instead of twice per hour), keeping logging parity via `PUBLISHING_CRON_SCHEDULE`.

## Technical Approach
- Treat PM2 as the single source of truth for scheduling.
- Update `ecosystem.config.cjs`:
  - set `cron_restart` to `0 */3 * * *`
  - set `env.PUBLISHING_CRON_SCHEDULE` to the same value for log context parity
- Update the module default schedule in `readPublishingConfig()` to match the new behavior for local/dev runs.
- Update module docs to include publishing cron schedule configuration (mirroring ingestion docs structure).

## Implementation Steps
- [x] Step 1: Update PM2 schedule for `cron:publishing:digest` to `0 */3 * * *` and keep `PUBLISHING_CRON_SCHEDULE` aligned.
- [x] Step 2: Update `readPublishingConfig()` default schedule and comments.
- [x] Step 3: Update `docs/modules/publishing.md` with a short “Schedule configuration” section for `PUBLISHING_CRON_SCHEDULE`.
- [x] Step 4: Run `npm run build` to ensure TypeScript compiles.

## Files to Modify/Create
- `ecosystem.config.cjs` - change `cron_restart` and `PUBLISHING_CRON_SCHEDULE` for `cron:publishing:digest`.
- `src/modules/publishing/public/publishingEnv.ts` - update default cron schedule + docs.
- `docs/modules/publishing.md` - document publishing cron schedule config and PM2 ownership.

## Testing Strategy (if needed)
- [ ] `npm run build`

## Rollback Plan
- Revert the changed files (or revert the commit) to restore the previous schedule `0,30 * * * *`.

## Open Questions
- None.

## Completed
- Date completed: 2026-02-07
- Deviations: None.
- Follow-ups: None.

