# new-bot-be

A Node.js + TypeScript backend skeleton that demonstrates a strict architecture:

- Modular monolith (`src/modules/*`)
- Use-case orchestrators (`src/modules/*/application`)
- Hexagonal architecture inside modules (Ports & Adapters)
- Express REST API and one-shot job/CLI entry points (`src/app/*`)
- Dependency wiring only in the composition root (`src/app/di`)
- No business logic in API or entry points

## Docs (start here)

- `docs/README.md`
- `docs/Architecture.md`

## Requirements

- Node.js (LTS recommended)

## Install

```bash
npm install
```

## Run (API)

```bash
npm run dev
```

- Routes: see `src/app/api/routes/*`
- Port: defaults to `3000` (override with `PORT`)

## Run (Jobs)

```bash
npm run job:ingest
npm run job:publish
```

These jobs run **once per invocation** and exit with a non-zero status code on failure (so you can run them from any external scheduler).

## Run (Ingestion CLI)

```bash
npm run cli:ingest
```

Dry-run (no DB writes):

```bash
npm run cli:ingest:dry-run
```

Playwright browser binaries are required (install once):

```bash
npx playwright install
```

## Test

```bash
npm test
```

## Build / Start

```bash
npm run build
npm run start
```
Jobs in production build:

```bash
npm run build
npm run start:job:ingest
npm run start:job:publish
```
