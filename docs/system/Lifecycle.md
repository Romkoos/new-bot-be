# System lifecycle (startup, runtime, shutdown)

## Purpose / scope

This document describes how the system behaves across its lifecycle:

- How each entry point starts (`API`, `Cron`, `CLI`).
- How dependencies are wired (DI container built once).
- How orchestrators are invoked.
- How the system shuts down (what terminates, what keeps running).

It also explains how **ingestion** participates as one of the scheduled/manual flows.

## Where it lives (entry points and orchestration surfaces)

### API entry point

- `src/app/api/server.ts`
- Example route: `src/app/api/routes/healthRoute.ts`

### Cron entry points

- Health cron: `src/app/cron/healthCron.ts`
- Ingestion cron: `src/app/cron/makoIngestCron.ts`

### CLI entry point

- Ingestion CLI: `src/app/cli/makoIngestCli.ts`

### Composition root (DI container)

- `src/app/di/container.ts`

### Orchestrators (use-case owners)

- Health: `src/modules/health/application/GetHealthStatusOrchestrator.ts`
- Ingestion: `src/modules/news-ingestion/application/MakoIngestOrch.ts`

## Lifecycle stages (high level)

Across all entry points, the runtime shape is:

**Entry point → build container → call orchestrator(s) → log/return result**

The key invariant:

- `src/app/*` is infrastructure-only.
- All business flow ordering is owned by orchestrators in `src/modules/*/application`.

## API process lifecycle

### Startup

1. Node process starts the API entry point.
2. API code builds the DI container once via `buildContainer()`.
3. Express server is configured with routes.
4. Server begins listening on `PORT` (default 3000).

### Request handling

For each incoming request (example: `GET /health`):

1. Route handler validates/parses input (minimal).
2. Handler calls exactly one orchestrator instance from the container.
3. Orchestrator returns a DTO.
4. Handler maps DTO to HTTP response and sends JSON.

### Shutdown

When the process receives a shutdown signal, Express is expected to stop accepting new connections and exit.

This repo’s entry point is minimal; if you add graceful shutdown, it belongs in `src/app/api/server.ts` (infrastructure), not in orchestrators.

## Cron process lifecycle

Cron entry points are long-running processes.

### Startup

1. Node process starts the cron entry point.
2. Cron builds the DI container once via `buildContainer()`.
3. It configures one (or more) schedules via `node-cron`.
4. It logs that the scheduler started.

### Runtime ticks

On each schedule tick:

1. Cron logs the run start.
2. Cron calls exactly one orchestrator per scheduled job.
3. Cron logs done (including counts/duration) or logs error.

### Shutdown

Cron processes keep running until terminated. There is no automatic shutdown.

If you need:

- retries
- backoff
- circuit breakers

Those are infrastructure concerns that can be implemented in the cron entry point around the orchestrator call.

## CLI process lifecycle (ingestion)

CLI is a short-lived process.

### Startup and run

1. Parse CLI args.
2. Apply optional env overrides (for scraper visibility/slow motion).
3. Build DI container once via `buildContainer()`.
4. Call orchestrator once (e.g. ingestion run).
5. Log done/error.

### Termination

The ingestion CLI explicitly terminates:

- `process.exit(0)` on success
- `process.exit(1)` on error

This prevents the process from hanging due to open handles.

## How ingestion participates in system orchestration

Ingestion is a use-case that can be invoked by:

- Cron (scheduled ingestion): `makoIngestCron.ts`
- CLI (manual ingestion): `makoIngestCli.ts`

Both are thin wrappers that:

- build the container
- invoke `MakoIngestOrch.run({ dryRun: ... })`
- do not embed scrape/hash/filter/store logic

The orchestrator owns the flow:

**scrape → normalize → hash → filter → store**

For deep dives, see:

- `docs/ingestion/Orchestration.md`
- `docs/ingestion/EntryPoints.md`

