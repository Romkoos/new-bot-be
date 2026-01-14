# Task: Remove cron execution ordering + health

## Context
- Ticket/Request: Remove the recently added cron execution ordering feature; run jobs manually from console. Also remove cron health check and related code. Trim `package.json` scripts to essentials.
- Related commits (introducing the behavior to remove):
  - `504c55b` — move cron scheduling to PM2 (`cron_restart`)
  - `02cae92` — add boot sequence on PM2 start
  - `3c33f6b` — add PM2 boot stamp + cron run gate + boot sequence orchestrator
- Related docs:
  - `docs/system/Lifecycle.md` (documents boot-time ordering + run gate)
  - `docs/ingestion/EntryPoints.md` (documents PM2 scheduling model)
  - `docs/modules/health.md` (mentions cron health entry point)

## Objective
Remove **all code and documentation** related to:
- **Cron execution ordering** (boot sequence + run gating)
- **Health** (module + API endpoint + any cron/PM2 health process)

Adjust the project so cron-like jobs can be run **manually from the console** (CLI), without PM2-managed ordering/scheduling.

## Technical Approach
- Delete the dedicated “ordering” subsystem:
  - `src/app/cron/pm2RunGate.ts`
  - `src/app/cron/pm2BootStamp.ts`
  - `src/app/cron/bootSequence.ts`
  - `src/modules/news-pipeline/**` (boot sequence orchestrator + public API)
  - Remove related wiring from `src/app/di/container.ts`
- Remove health entirely:
  - Delete `src/modules/health/**`
  - Remove API `GET /health` route and its registration
  - Remove any cron/PM2 health process (`src/app/cron/healthCron.ts`, and `cron:health` from `ecosystem.config.cjs`)
- Simplify cron execution model:
  - Prefer existing CLI entry points (`src/app/cli/*.ts`) for manual runs.
  - Keep ingestion and publishing as **separate runnable jobs** (independent entry points you run individually).
- Update docs to reflect the new reality (no PM2 cron ordering/scheduling).
- Remove dependencies that become unused (e.g., `node-cron` if not referenced anywhere).

## Implementation Steps
- [x] Step 0: Branch prep
  - Ensure base branch is up to date (`origin/main` is the repo default; there is no `master` branch).
  - Create a new cleanup branch from updated base.
  - Clean working tree (discard local `ecosystem.config.cjs` edits).
- [x] Step 1: Remove cron ordering subsystem
  - Delete boot-sequence entry point + PM2 gate helpers.
  - Delete `news-pipeline` module and its public exports.
  - Remove `newsPipeline.bootSequence` wiring from DI container.
- [ ] Step 2: Remove cron health process
  - Delete `src/app/cron/healthCron.ts`.
  - Remove any references (PM2 app, scripts, docs).
- [ ] Step 2b: Remove health module + HTTP health endpoint
  - Delete `src/modules/health/**`.
  - Remove `healthRoute` and any health route registration from the API server.
  - Remove health wiring from the DI container.
- [ ] Step 3: Keep ingest/publish as separate one-shot jobs
  - Convert `src/app/cron/newsIngestCron.ts` and `src/app/cron/publishingCron.ts` into **one-shot** scripts (run once and `process.exit`).
  - Remove PM2-specific behavior (`keepAlive`, run gate).
- [ ] Step 4: Remove PM2 cron scheduling config + scripts (if no longer used)
  - Remove `ecosystem.config.cjs` (or strip it down if you still want PM2 for something else).
  - Remove `pm2:*` scripts from `package.json` if PM2 is no longer a supported workflow.
- [ ] Step 5: Documentation cleanup
  - Update `docs/system/Lifecycle.md` to remove cron ordering/run-gate narrative.
  - Update `docs/ingestion/EntryPoints.md` to describe manual CLI runs (and optionally “external scheduler runs CLI”).
  - Update `docs/modules/health.md` to remove cron health entry point usage section.
- [ ] Step 6: Dependency cleanup + build verification
  - Remove `node-cron` dependency if unused.
  - Ensure `npm run build` succeeds after deletions.

## Files to Modify/Create
- **Delete**:
  - `src/app/cron/bootSequence.ts`
  - `src/app/cron/pm2RunGate.ts`
  - `src/app/cron/pm2BootStamp.ts`
  - `src/app/cron/healthCron.ts`
  - `src/app/api/routes/healthRoute.ts`
  - `src/modules/health/**`
  - `src/modules/news-pipeline/**`
- **Modify**:
  - `src/app/di/container.ts` — remove `newsPipeline.bootSequence`
  - `src/app/api/server.ts` — remove health route registration
  - `ecosystem.config.cjs` — remove cron apps (or delete file)
  - `package.json` — keep only essential scripts; drop PM2 cron scripts; drop `dev:cron*`/`start:cron*` as applicable
  - `docs/system/Lifecycle.md`
  - `docs/ingestion/EntryPoints.md`
  - `docs/modules/health.md`

## Testing Strategy (if needed)
- [ ] `npm run build`
- [ ] Manually run CLIs:
  - `npm run dev:cli:ingest -- --dry-run`
  - `npm run dev:cli:publish`
- [ ] Start API: `npm run dev` and confirm the API still starts (no `/health`).

## Rollback Plan
- Revert the cleanup commit(s) on the cleanup branch.
- Alternatively, restore the removed files from `main` via `git checkout origin/main -- <paths>`.

## Open Questions
- (Resolved) Remove all health (module + API + cron).
- (Resolved) Keep ingestion and publishing as separate one-shot jobs.
- Should we remove **all** PM2-related scripts/config (`ecosystem.config.cjs`, `pm2:*` scripts), or do you still use PM2 for any non-cron purpose?

