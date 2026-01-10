# Ingestion: Mako (`mako`)

## Purpose / scope

This doc explains the **cron-triggered** news ingestion flow for the source:

- `https://www.mako.co.il/news-channel12`

The flow is designed to be:
- **Idempotent** (re-runs never create duplicates)
- **Observable** (logs make debugging possible without stepping into code)
- **Architecture-compliant** (thin entry-points, orchestrator-owned flow, explicit DI)

## Where it lives (key files / entry points)

### Use-case owner (single place for the full flow)
- Orchestrator: `src/modules/news-ingestion/application/MakoIngestOrch.ts`

### Infrastructure entry-points (thin wrappers)
- Cron: `src/app/cron/makoIngestCron.ts`
- CLI (manual trigger): `src/app/cli/makoIngestCli.ts`

### Ports (hexagonal boundaries)
- Scraper port: `src/modules/news-ingestion/ports/MakoScraperPort.ts`
- Hasher port: `src/modules/news-ingestion/ports/NewsItemHasherPort.ts`
- Repository port: `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts`

### Adapters (infrastructure implementations)
- Playwright scraper: `src/modules/news-ingestion/adapters/PwMakoScraper.ts`
- SHA-256 hasher: `src/modules/news-ingestion/adapters/Sha256Hasher.ts`
- SQLite repo (`better-sqlite3`): `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`

### Composition root (adapter instantiation only)
- DI container: `src/app/di/container.ts`

## Public API rule (important)

`src/modules/*/public/index.ts` exports **only public contracts**:
- orchestrator(s)
- DTOs
- port types/interfaces (if needed)

It must **not** export adapters or adapter factories.
Adapters are instantiated **only** in `src/app/di/container.ts`.

## Step-by-step runtime flow

### 1) Cron/CLI triggers the use-case
- Cron schedules work via `MAKO_CRON_SCHEDULE`.
- CLI runs a single execution and supports `--dry-run`.

Both entry-points:
- build the DI container once
- call **only** `MakoIngestOrch.run(...)`
- log start/end/error

### 2) Scrape (browser-based, normalized output only)
Adapter:
- `PwMakoScraper`

Scraping rules:
- Navigate to `https://www.mako.co.il/news-channel12`
- Wait until loaded
- Container: `.desktop-drawer-news`
- Items: `.mc-extendable-text__content > div > div`
- Take the **first 5** items from the DOM tree (in DOM order)
- Extract:
  - `rawText` (main text/teaser)
  - `publishedAt` from `.mc-message-footer__time` if present (`HH:mm`, date=today → ISO)

Constraints:
- Scraper **must not** hash
- Scraper **must not** access the database

### 3) Normalize → hash (stable)
Hashing is coordinated by the orchestrator and delegated to the hasher port.

Hash stability rule (before hashing, minimal normalization):
- trim strings
- collapse whitespace
- ensure `publishedAt` is consistently an ISO string or `null`

Hash is computed from the **normalized representation**, so identical content always produces the same hash.

### 4) Filter
Before storing:
- compare hashes to existing stored items via `NewsItemsRepositoryPort.findExistingHashes(...)`
- filter out any item whose hash already exists

If zero items remain:
- the run **exits early**
- this is logged and treated as success

### 5) Store (idempotent)
Storage:
- SQLite (via `better-sqlite3`)
- single table: `news_items`
- DB-level dedup safety: `UNIQUE(hash)`

Repository constraints:
- persistence only (no business rules)
- inserts only, using `hash` uniqueness to prevent duplicates
- sets `scraped_at` as an ISO timestamp at write time

## Data contracts

### Stored table: `news_items`
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `source TEXT` (persisted source id, e.g. `"mako-channel12"`)
- `hash TEXT UNIQUE`
- `raw_text TEXT`
- `published_at TEXT NULL` (ISO)
- `scraped_at TEXT` (ISO, now)
- `payload_json TEXT` (full normalized payload)

## Configuration

- `MAKO_CRON_SCHEDULE`
  - Cron expression for scheduling ingestion.
  - Default: `*/5 * * * *`

- `NEWS_BOT_SQLITE_PATH`
  - SQLite DB file path.
  - Default: `./data/news-bot.sqlite`

- `MAKO_SCRAPER_HEADLESS`
  - When `true` (default), runs headless.
  - When `false`, shows the browser UI (useful for debugging).

- `MAKO_SCRAPER_SLOWMO_MS`
  - Optional delay (ms) between Playwright actions (useful when running headful).

## Playwright requirement (browser binaries)

This project requires Playwright browser binaries, managed externally.

Install once:

```bash
npx playwright install
```

## Observability (what to expect in logs)

The orchestrator logs (at least):
- start of ingestion
- scraped item count
- filtered/new item count
- stored count (or “would store” count in dry-run)
- early exit when no new items are found
- total execution time

Cron and CLI also log start/end/error at the entry-point level.

## Failure modes & debugging

- Scraping failures (navigation/selector timeout):
  - surfaced as errors from the scraper adapter
  - visible in cron/CLI logs with error context
- Database failures (file path, permissions, corruption):
  - surfaced as errors from the repository adapter
  - visible in cron/CLI logs with error context

