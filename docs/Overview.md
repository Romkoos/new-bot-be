# Overview

## Purpose / scope

This repository demonstrates a **Node.js + TypeScript backend** using a **Modular Monolith** architecture with:
- **Use-case Orchestrators**
- **Hexagonal architecture** (Ports & Adapters) inside modules
- **REST API** and **Cron** as entry-points
- **Dependency wiring only in the composition root**
- **No business logic in API or Cron**

The demo module is `health`, whose use-case returns:

```json
{ "status": "ok", "time": "<ISO string>" }
```

## Where it lives (entry-points, composition root, modules)

### Entry-points (infrastructure only)

- `src/app/api/` — REST API entry-point(s)
- `src/app/cron/` — Cron entry-point(s)

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
- `import { GetHealthStatusOrchestrator } from "../../modules/health/public";`

Forbidden:
- `import { SystemTimeAdapter } from "../../modules/health/adapters/SystemTimeAdapter";`

## Runtime flow (REST API)

### Request

- `GET /health`

### Step-by-step

1. `src/app/api/server.ts` starts Express and builds the container via `buildContainer()`.
2. `src/app/api/routes/healthRoute.ts` handles `GET /health`.
3. The handler calls **only** the orchestrator instance from the container.
4. The orchestrator returns a DTO which is serialized to JSON.

High-signal excerpt:

```ts
// src/app/api/routes/healthRoute.ts
const result = container.health.getHealthStatusOrchestrator.run();
res.json(result);
```

## Runtime flow (Cron)

### Schedule

- Every minute (`* * * * *`)

### Step-by-step

1. `src/app/cron/healthCron.ts` builds the container once via `buildContainer()`.
2. The scheduled job calls **only** the orchestrator instance and logs the DTO.

High-signal excerpt:

```ts
// src/app/cron/healthCron.ts
const result = container.health.getHealthStatusOrchestrator.run();
container.logger.info("cron:health", result);
```

## Demo module: `health`

### Use-case

Return `{ status: "ok", time: "<ISO string>" }`.

### Implementation map

- Port: `src/modules/health/ports/TimePort.ts`
- Adapter: `src/modules/health/adapters/SystemTimeAdapter.ts`
- Orchestrator: `src/modules/health/application/GetHealthStatusOrchestrator.ts`
- DTO: `src/modules/health/dto/GetHealthStatusResponse.ts`
- Public API: `src/modules/health/public/index.ts`

### Contract

The orchestrator returns `GetHealthStatusResponse`:

```ts
export interface GetHealthStatusResponse {
  status: "ok";
  time: string;
}
```

## Extension points

- Add new use-cases by creating new orchestrators under `src/modules/<module>/application/`.
- Add new external dependencies (HTTP, filesystem, etc.) by:
  - defining a port in `ports/`
  - implementing it in `adapters/`
  - wiring it in `src/app/di/container.ts`

