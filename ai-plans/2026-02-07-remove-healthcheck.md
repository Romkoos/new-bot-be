# Task: Remove healthcheck functionality

## Context
- Ticket/Request: Remove `healthCron` and all healthcheck-related functionality.
- Related docs:
  - `docs/modules/health.md`
  - `docs/system/Lifecycle.md`
  - `docs/system/DependencyInjection.md`
  - `docs/modules/news-pipeline.md`
  - `README.md`

## Objective
Remove the healthcheck module and all related runtime surfaces (API route, cron entry point, PM2 config, DI wiring, and references in the boot sequence), then clean up all documentation and scripts so no healthcheck-related code remains.

## Technical Approach
- Remove the `health` module (`src/modules/health/*`) and its API surface (`GET /api/health`).
- Remove the cron entry-point (`src/app/cron/healthCron.ts`) and the PM2 process definition (`cron:health`).
- Update the boot-time pipeline (`BootSequenceOrchestrator`) and DI wiring to remove the health step entirely while preserving the remaining boot sequence steps.
- Update docs and repo command references so they no longer mention healthcheck.

## Implementation Steps
- [x] Step 1: Remove runtime entry points for healthcheck.
  - Delete `src/app/cron/healthCron.ts`.
  - Delete `src/app/api/routes/healthRoute.ts`.
  - Update `src/app/api/server.ts` to stop registering the health route.
- [x] Step 2: Remove the health module and DI wiring.
  - Delete `src/modules/health/**`.
  - Update `src/app/di/container.ts`:
    - Remove `health` container section and all wiring for `GetHealthStatusOrchestrator`.
    - Update `BootSequenceOrchestrator` wiring to no longer require a health orchestrator dependency.
- [x] Step 3: Update boot sequence orchestrator to drop the health step.
  - Update `src/modules/news-pipeline/application/BootSequenceOrchestrator.ts` types and logic:
    - Remove `health` dependency, types, and returned step result.
    - Keep strict ordering for remaining steps.
  - Update diagrams/docs under `src/modules/news-pipeline/README.md` and `docs/modules/news-pipeline.md`.
- [x] Step 4: Remove PM2 and npm script references to health cron.
  - Update `ecosystem.config.cjs` to remove `cron:health`.
  - Update `package.json` scripts:
    - Remove `dev:cron` and `start:cron` (or repoint if there is a better default).
    - Update `pm2:logs:cron` to exclude `cron:health`.
  - Update `README.md` command examples (remove `/api/health` smoke test and health cron references).
- [x] Step 5: Documentation cleanup pass (no healthcheck references remain).
  - Delete `docs/modules/health.md`.
  - Update `docs/system/Lifecycle.md` and `docs/system/DependencyInjection.md` to remove health examples and diagrams.
  - Update `docs/modules/README.md`, `docs/README.md`, `docs/Overview.md`, `docs/Architecture.md` to remove any remaining references.
  - Remove historical plan doc `ai-plans/2026-01-10-health-skeleton.md` if it is no longer useful.
- [x] Step 6: Verification
  - Run TypeScript build: `npm run build`
  - Run tests: `npm test`
  - Grep pass: ensure no `healthCron`, `GetHealthStatus`, `/health`, or `modules/health` references remain.

## Files to Modify/Create
- `src/app/api/server.ts` - remove health route registration.
- `src/app/di/container.ts` - remove health wiring and adjust boot sequence deps.
- `src/modules/news-pipeline/application/BootSequenceOrchestrator.ts` - remove health step.
- `src/modules/news-pipeline/README.md` - update diagram.
- `docs/system/Lifecycle.md` - remove health references and update diagrams.
- `docs/system/DependencyInjection.md` - remove health wiring section.
- `docs/modules/news-pipeline.md` - update deep dive diagram and text.
- `ecosystem.config.cjs` - remove `cron:health`.
- `package.json` - remove/update health cron scripts and PM2 logs script.
- `README.md` - remove health smoke test and cron references.

### Files to Delete
- `src/app/cron/healthCron.ts`
- `src/app/api/routes/healthRoute.ts`
- `src/modules/health/**`
- `docs/modules/health.md`
- `ai-plans/2026-01-10-health-skeleton.md` (optional cleanup)

## Testing Strategy (if needed)
- [ ] `npm run build`
- [ ] `npm test`

## Rollback Plan
- Revert the branch or the commit(s) created for this task.

## Open Questions
- None.

## Completed

- Date completed: 2026-02-07
- Notes:
  - `npm run build` passes.
  - `npm test` was executed but fails locally due to a `better-sqlite3` native module Node version mismatch (environment issue, not related to healthcheck removal changes).

