# Task: Add publishing cron (twice per hour)

## Context
- Ticket/Request: Add a cron entry point that runs the publishing use-case twice per hour.
- Related docs:
  - `docs/system/Lifecycle.md` (cron processes build container once, schedule jobs)
  - `docs/ingestion/EntryPoints.md` (cron entry-point pattern)

## Objective
Add a long-running cron entry point that:
- loads `.env` / `.env.local` (so secrets and config are available)
- builds the DI container once
- schedules `container.publishing.publishDigest.run()` **twice per hour**
- logs start/done/error per tick without crashing the process on failure

## Technical Approach
- Create `src/app/cron/publishingCron.ts` using `node-cron`, mirroring `newsIngestCron.ts`.
- Prefer a module-owned schedule config helper (pattern used by ingestion):
  - Add `readPublishingConfig(process.env)` under `src/modules/publishing/public/`
  - Default cron schedule: `0,30 * * * *` (minute 0 and 30 of every hour)
  - Optional override env var (provider-agnostic): `PUBLISHING_CRON_SCHEDULE`
- Add npm scripts:
  - `dev:cron:publish`: `tsx watch src/app/cron/publishingCron.ts`
  - `start:cron:publish`: `node dist/app/cron/publishingCron.js`

## Implementation Steps
- [x] Step 1: Add publishing runtime config helper (`PUBLISHING_CRON_SCHEDULE`) and export from module public API.
- [x] Step 2: Add `src/app/cron/publishingCron.ts` (load env, build container once, schedule job).
- [x] Step 3: Add npm scripts for dev/start cron publish.
- [ ] Step 4: Build and do a quick smoke run of the cron entry point (it should start and schedule without throwing).

## Files to Modify/Create
- `src/modules/publishing/public/index.ts` - export config helper + env keys (contracts only).
- `src/modules/publishing/public/publishingConfig.ts` - `readPublishingConfig`.
- `src/modules/publishing/public/publishingEnv.ts` - `PUBLISHING_CRON_SCHEDULE` key.
- `src/app/cron/publishingCron.ts` - new cron entry point.
- `package.json` - add scripts.
- `docs/system/Lifecycle.md` (optional) - add publishing cron to the list of cron entry points.

## Testing Strategy
- [ ] `npm run build`
- [ ] `npx --yes tsx src/app/cron/publishingCron.ts` starts the scheduler and logs startup message

## Rollback Plan
- Remove the new cron entry point and scripts; publishing remains CLI-triggered only.

## Open Questions
- None (schedule default is fixed to twice per hour: `0,30 * * * *`).

