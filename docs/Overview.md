# Overview

## Purpose / scope

This repository demonstrates a **Node.js + TypeScript backend** using a **Modular Monolith** architecture with:
- **Use-case Orchestrators**
- **Hexagonal architecture** (Ports & Adapters) inside modules
- **REST API** and **Job/CLI** entry-points
- **Dependency wiring only in the composition root**
- **No business logic in API or entry points**

This repo focuses on ingestion + publishing flows and keeps entry points thin.

## Where it lives (entry-points, composition root, modules)

### Entry-points (infrastructure only)

- `src/app/api/` — REST API entry-point(s)
- `src/app/cron/` — one-shot job entry-point(s)
- `src/app/cli/` — CLI entry-point(s)

**Rule:** entry-points may only call orchestrators (via module Public APIs) and must not contain business logic.

### Composition root (dependency wiring only)

- `src/app/di/container.ts` — builds the dependency graph.

**Rule:** adapters and orchestrators are instantiated **only** here.

### Modules (business world)

- `src/modules/<module>/` — business modules, each with hexagonal boundaries:
  - `application/` — orchestrators only
  - `ports/` — abstractions used by orchestrators
  - `adapters/` — implementations of ports
  - `dto/` — DTOs used in public contracts
  - `public/index.ts` — **only allowed import surface** for other layers/modules

## Golden rules (strict)

### Orchestrators

- Orchestrators live **only** in `src/modules/*/application`.
- Orchestrators depend **only** on:
  - module ports (`src/modules/*/ports`)
  - other modules **via their `public/` API** (no deep imports)
- Orchestrators do not import:
  - adapters
  - `src/app/*`

### Ports & Adapters

- Ports are interfaces in `src/modules/*/ports`.
- Adapters implement ports in `src/modules/*/adapters`.
- Adapters are selected/instantiated **only** in `src/app/di`.

### Public API rule (no deep imports)

Other layers must not import internal module files directly.

Allowed:
- `import { NewsIngestOrch } from "../../modules/news-ingestion/public";`

Forbidden:
- deep imports into module internals (e.g. `.../adapters/*`, `.../application/*`)

## Runtime flow (REST API)

### Request

- `GET /digests`

### Step-by-step

1. `src/app/api/server.ts` starts Express and builds the container via `buildContainer()`.
2. A route handler (e.g. `src/app/api/routes/digestsRoute.ts`) calls an orchestrator from the container.
3. The handler calls **only** the orchestrator instance from the container.
4. The orchestrator returns a DTO which is serialized to JSON.

High-signal excerpt (route calls orchestrator only):

```ts
// Example: src/app/api/routes/digestsRoute.ts
const result = await container.publishing.listDigests.run();
res.json(result);
```

## Runtime flow (Job)

### Step-by-step

1. A one-shot job entry point (e.g. `src/app/cron/newsIngestCron.ts`) loads env (if needed) and builds the container via `buildContainer()`.
2. It calls **exactly one** orchestrator and logs start/done/error.
3. It exits (0 on success, non-zero on failure).

## Extension points

- Add new use-cases by creating new orchestrators under `src/modules/<module>/application/`.
- Add new external dependencies (HTTP, filesystem, etc.) by:
  - defining a port in `ports/`
  - implementing it in `adapters/`
  - wiring it in `src/app/di/container.ts`

