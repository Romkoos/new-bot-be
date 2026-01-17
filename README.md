# new-bot-be

A Node.js + TypeScript backend skeleton that demonstrates a strict architecture:

- Modular monolith (`src/modules/*`)
- Use-case orchestrators (`src/modules/*/application`)
- Hexagonal architecture inside modules (Ports & Adapters)
- Express REST API and node-cron as entry-points (`src/app/*`)
- Dependency wiring only in the composition root (`src/app/di`)
- No business logic in API or Cron

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

- Route: `GET /api/health`
- Port: defaults to `3000` (override with `PORT`)

## Run (Cron)

```bash
npm run dev:cron
```

This logs the health status every minute using the same orchestrator wiring as the API.

## Run (Mako Channel 12 ingestion)

### Manual (CLI)

```bash
npm run dev:cli:mako
```

Dry-run (no DB writes):

```bash
npm run dev:cli:mako:dry-run
```

### Scheduled (Cron)

```bash
npm run dev:cron:mako
```

Configuration:
- `MAKO_CRON_SCHEDULE` (default: `*/5 * * * *`)
- `NEWS_BOT_SQLITE_PATH` (default: `./data/news-bot.sqlite`)
- `MAKO_SCRAPER_HEADLESS` (default: `true`, set to `false` to see the browser UI)
- `MAKO_SCRAPER_SLOWMO_MS` (optional, e.g. `200` for slower visible steps)

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

Cron in production build:

```bash
npm run build
npm run start:cron
```

Mako ingestion in production build:

```bash
npm run build
npm run start:cron:mako
```
