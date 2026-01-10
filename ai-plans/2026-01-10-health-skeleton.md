# Task: Node.js + TypeScript backend skeleton (Express + node-cron) with modular monolith architecture

## Context
- Ticket/Request: Create a demo backend project skeleton proving strict modular monolith + orchestrators + hexagonal architecture.
- Related docs: None found (no `docs/` directory in this repo yet).

## Objective
Create the filesystem and one minimal demo module (`health`) that proves:
- API and Cron are entry-points only (no business logic).
- Orchestrators live only in `modules/*/application`.
- Ports & Adapters are inside modules and wired only in the composition root.
- Cross-module imports are only via each module’s Public API.

## Technical Approach
- Use **Express** for HTTP entry-point (`GET /health`).
- Use **node-cron** for a cron entry-point that runs every minute and calls the same orchestrator instance.
- Implement a single module `modules/health` following hexagonal architecture:
  - `ports/TimePort.ts` defines the abstraction.
  - `adapters/SystemTimeAdapter.ts` implements `TimePort`.
  - `application/GetHealthStatusOrchestrator.ts` contains the use-case flow.
  - `dto/GetHealthStatusResponse.ts` defines the response DTO.
  - `public/index.ts` is the only export surface for external consumers (app layer).
- Provide `src/app/di/container.ts` as the **composition root**, wiring the adapter to the orchestrator and exposing `buildContainer()`.
- Add a minimal shared logger `src/shared/observability/logger.ts`.
- Add a unit test for the orchestrator with a mocked `TimePort` using **Vitest**.

## Implementation Steps
- [x] Step 1: Add project scaffolding (`package.json`, `tsconfig.json`, scripts, base folder structure).
- [x] Step 2: Implement `shared/observability/logger.ts`.
- [x] Step 3: Implement `health` module (port, adapter, DTO, orchestrator, public API).
- [x] Step 4: Implement composition root `src/app/di/container.ts` with explicit dependency injection.
- [x] Step 5: Implement Express API entry-point (`src/app/api/server.ts` + route `GET /health`) calling orchestrator from container.
- [x] Step 6: Implement Cron entry-point (`src/app/cron/healthCron.ts`) calling the same orchestrator instance and logging the result.
- [x] Step 7: Add orchestrator unit test with mocked `TimePort` (Vitest).
 - [x] Step 8: Create or update **mandatory** documentation in `docs/` describing:
  - the architecture
  - the demo module
  - the API and Cron flow
 - [x] Step 9: Add `.gitignore` and verify `dev`, `test`, `build`, `start` scripts.
- [ ] Step 10: Mark all steps as complete in this plan and add a `## Completed` section (date, deviations, follow-ups).
- [ ] Step 11: Create final commit and push the branch to the remote repository.

## Files to Modify/Create
- `package.json` - scripts (`dev`, `test`, `build`, `start`) and dependencies.
- `tsconfig.json` - TypeScript strict configuration.
- `src/app/api/server.ts` - Express server bootstrap (entry-point only).
- `src/app/api/routes/healthRoute.ts` - `GET /health` handler calling orchestrator only.
- `src/app/cron/healthCron.ts` - cron schedule calling orchestrator only.
- `src/app/di/container.ts` - composition root wiring adapters to orchestrators.
- `src/modules/health/ports/TimePort.ts` - port interface.
- `src/modules/health/adapters/SystemTimeAdapter.ts` - adapter implementation.
- `src/modules/health/dto/GetHealthStatusResponse.ts` - response DTO.
- `src/modules/health/application/GetHealthStatusOrchestrator.ts` - use-case orchestrator.
- `src/modules/health/public/index.ts` - Public API exports (only allowed import surface).
- `src/modules/health/tests/GetHealthStatusOrchestrator.test.ts` - unit test with mocked port.
- `src/shared/observability/logger.ts` - `info` / `error` wrappers.
- `docs/README.md` - docs table of contents.
- `docs/Overview.md` - architecture overview + “how the demo works”.
- `.gitignore` - ignore build output, node_modules, local env files, etc.

## Testing Strategy (if needed)
- [ ] Orchestrator unit test: fixed time returned by mocked `TimePort` → deterministic `{ status: "ok", time }` assertion.
- [ ] Smoke: `npm run dev` then `GET /health` returns expected JSON.
- [ ] Cron smoke: `npm run start` shows minute log output with the same DTO shape.

## Rollback Plan
Delete the created files and branch `task/2026-01-10-health-skeleton`, then return to `master`.

## Open Questions
- Is a Git remote already configured for this repo? (Currently `git remote -v` is empty; we may need you to add a remote before Step 11.)

