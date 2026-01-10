# Module: `news-ingestion`

## Purpose / scope

The `news-ingestion` module owns the ingestion use-case for Mako news:

- scrape the target page (browser automation)
- normalize content
- compute stable hashes
- filter previously stored items
- persist only new items

It is designed to be:

- **Idempotent** (re-runs do not create duplicates)
- **Testable** (orchestrator unit tests with mocked ports)
- **Architecture-compliant** (ports/adapters + explicit DI + thin entry points)

## Where it lives

- Module root: `src/modules/news-ingestion/`
- Public API: `src/modules/news-ingestion/public/index.ts`

## Ownership

The module owns a single primary use-case orchestrator:

- `MakoIngestOrch`

It also owns the configuration contract for Mako ingestion via:

- `MAKO_ENV`
- `readMakoConfig(env)`

## Public API (`src/modules/news-ingestion/public/index.ts`)

This is the only allowed import surface for:

- app layer entry points (`src/app/*`)
- other modules (if they ever call ingestion)
- tests outside the module (rare)

Exports (contracts only):

- Orchestrator:
  - `MakoIngestOrch`
- DTOs:
  - `MakoIngestResult`
  - `MakoScrapedItem`
- Ports:
  - `MakoScraperPort`
  - `NewsItemHasherPort`, `NewsItemHashInput`
  - `NewsItemsRepositoryPort`, `NewNewsItemToStore`, `InsertManyResult`
- Config helper:
  - `MAKO_ENV`
  - `readMakoConfig`
  - `MakoRuntimeConfig`, `MakoScraperRuntimeConfig`

Adapters are intentionally not exported. They are instantiated in DI.

## Orchestrator: `MakoIngestOrch`

File:

- `src/modules/news-ingestion/application/MakoIngestOrch.ts`

### Responsibility (flow owner)

This orchestrator owns the full use-case ordering:

1. Scrape (`MakoScraperPort.scrapeFirstFive`)
2. Normalize for hash stability
3. Hash (`NewsItemHasherPort.hashNormalized`)
4. Filter (`NewsItemsRepositoryPort.findExistingHashes`)
5. Persist new items (`NewsItemsRepositoryPort.insertMany`) unless dry-run

### Input contract

- `run({ dryRun: boolean })`

### Output contract

Returns `MakoIngestResult`:

- `source: "mako-channel12"`
- `dryRun`
- `scrapedCount`
- `newItemsCount`
- `storedCount`
- `durationMs`

### Normalization rules (before hashing)

Owned by orchestrator:

- `rawText`: trim + collapse whitespace
- `publishedAt`: ISO string or null
- empty text items are dropped

### Idempotency model

Two layers:

- use-case filters existing hashes before inserting
- DB enforces `UNIQUE(hash)` and uses `INSERT OR IGNORE` as backstop

### Logs

Orchestrator emits:

- `ingestion:mako:start`
- `ingestion:mako:scraped`
- `ingestion:mako:filtered`
- `ingestion:mako:early-exit:no-new-items`
- `ingestion:mako:done`

For log semantics, see `docs/ingestion/Observability.md`.

## Ports (hexagonal contracts)

### `MakoScraperPort`

File:

- `src/modules/news-ingestion/ports/MakoScraperPort.ts`

Contract:

- `scrapeFirstFive(): Promise<ReadonlyArray<MakoScrapedItem>>`

Constraints:

- infrastructure-only
- no hashing
- no persistence access

### `NewsItemHasherPort`

File:

- `src/modules/news-ingestion/ports/NewsItemHasherPort.ts`

Contract:

- `hashNormalized(input: NewsItemHashInput): string`

`NewsItemHashInput` is canonical input (already normalized):

- `source: "mako-channel12"`
- `rawText: string`
- `publishedAt: string | null`

### `NewsItemsRepositoryPort`

File:

- `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts`

Contracts:

- `findExistingHashes(hashes): Promise<ReadonlySet<string>>`
- `insertMany(items): Promise<{ insertedCount: number }>`

Constraints:

- persistence only (no business logic)
- set `scraped_at` at insertion time
- dedup safety is DB uniqueness

## Adapters (infrastructure implementations)

### Playwright scraper: `PwMakoScraper`

File:

- `src/modules/news-ingestion/adapters/PwMakoScraper.ts`

Highlights:

- Navigates to `https://www.mako.co.il/news-channel12`
- Strictly clicks `.mc-drawer__btn` across frames
- Waits for `.desktop-drawer-news`
- Extracts **first 5** items from DOM order using a single `evaluateAll` for performance
- Parses publish time from `.mc-message-footer__time` (`HH:mm` + today -> ISO)
- Configurable headless/headful, slowMo, persistent context, locale/timezone/UA

Deep dive:

- `docs/ingestion/Scraping.md`

### Hasher: `Sha256Hasher`

File:

- `src/modules/news-ingestion/adapters/Sha256Hasher.ts`

Behavior:

- canonicalizes input with stable JSON key order
- computes SHA-256 hex digest

Deep dive:

- `docs/ingestion/Hashing.md`

### SQLite repository: `SqliteNewsRepo`

File:

- `src/modules/news-ingestion/adapters/SqliteNewsRepo.ts`

Behavior:

- ensures parent directory exists (unless `:memory:`)
- ensures schema exists
- queries existing hashes via `IN (...)`
- inserts batch via transaction + `INSERT OR IGNORE`

Deep dive:

- `docs/ingestion/Storage.md`

## Configuration contract (module-owned)

File:

- `src/modules/news-ingestion/public/makoEnv.ts`

Exports:

- `MAKO_ENV` (env var key constants)
- `readMakoConfig(env)` (parsing + defaults)

Deep dive:

- `docs/ingestion/Config.md`

## Runtime integration (system orchestration participation)

### DI wiring

File:

- `src/app/di/container.ts`

Wiring:

- read config: `readMakoConfig(process.env)`
- instantiate adapters (`PwMakoScraper`, `Sha256Hasher`, `SqliteNewsRepo`)
- instantiate orchestrator (`MakoIngestOrch`)
- expose as: `container.ingest.mako`

### Cron entry point

File:

- `src/app/cron/makoIngestCron.ts`

Behavior:

- reads schedule from `readMakoConfig(process.env).cronSchedule`
- schedules repeated runs
- calls orchestrator with `dryRun: false`
- logs `cron:mako:*`

### CLI entry point

File:

- `src/app/cli/makoIngestCli.ts`

Behavior:

- supports `--dry-run`
- supports `--headful/--headed` (sets `MAKO_SCRAPER_HEADLESS=false`)
- supports `--slowmo-ms=...`
- calls orchestrator once and exits explicitly
- logs `cli:mako:*`

## Tests

File:

- `src/modules/news-ingestion/tests/MakoIngestOrch.test.ts`

What is unit-tested:

- normalization before hashing
- filtering and early exit behavior
- dry-run does not write to persistence but returns correct counts

What is intentionally not unit-tested here:

- Playwright browser behavior (integration concern)
- SQLite behavior (adapter concern)

## Related docs

- Ingestion deep dives:
  - `docs/ingestion/README.md`
  - `docs/ingestion/Orchestration.md`
  - `docs/ingestion/Scraping.md`
  - `docs/ingestion/Hashing.md`
  - `docs/ingestion/Storage.md`
  - `docs/ingestion/Observability.md`
  - `docs/ingestion/FailureModes.md`
- System docs:
  - `docs/system/Lifecycle.md`
  - `docs/system/DependencyInjection.md`

