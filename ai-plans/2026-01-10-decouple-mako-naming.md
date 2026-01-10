# Task: Decouple “mako” naming from ingestion (site-agnostic core)

## Context
- Ticket/Request: “References to mako should exist only in the scraper layer. Only the scraper is tied to mako — nothing else.”
- Related docs:
  - `docs/modules/news-ingestion.md`
  - `docs/ingestion/README.md`
  - `docs/ingestion/Orchestration.md`
  - `docs/ingestion/EntryPoints.md`
  - `docs/ingestion/Observability.md`
  - `docs/ingestion/Scraping.md`
  - `docs/system/DependencyInjection.md`

## Objective
Refactor the project so that **only the scraper adapter layer** is aware of the concrete site/source (“mako”).

Specifically:
- Orchestrator(s), deps types, ports, DTOs, app entry-points, DI container wiring, and docs must be **site-agnostic**.
- The concrete source id (currently `"mako-channel12"`) and URL/DOM selectors must be confined to the **scraper adapter**.
- Swapping `PwMakoScraper` for a different scraper must not require changes outside the scraper adapter (beyond DI wiring to choose the new adapter).

## Technical Approach
- **Generalize contracts**:
  - Rename Mako-specific orchestrator/DTOs/ports to generic “news ingestion” names.
  - Remove Mako-specific string literal typing from ports/DTOs (`"mako-channel12"` → `string`) so the core is not coupled to a particular site.
- **Source id ownership**:
  - Make the **scraper port expose the source id** (`source: string`) so the orchestrator never hardcodes it.
  - Keep the hash canonical key name `source` (do not rename to `sourceId`) to avoid changing hash canonicalization semantics.
- **Entry points & DI**:
  - Rename cron/cli/container fields away from `mako` (e.g. `container.ingest.news`).
  - Keep adapters unexported from module public API (instantiated in DI).
- **Docs**:
  - Update ingestion docs to describe a site-agnostic ingestion flow.
  - Keep “Mako” mentions only in the scraper adapter documentation sections (where we describe `PwMakoScraper` specifically).

## Implementation Steps
- [x] Step 1: Rename and generalize ingestion contracts (orchestrator/ports/DTOs)
  - Rename `MakoIngestOrch` → `NewsIngestOrch` (or similar) and remove any hardcoded `"mako-channel12"` literals.
  - Rename `MakoScraperPort` → `NewsScraperPort` and add `readonly source: string`.
  - Rename `MakoScrapedItem` → `ScrapedNewsItem` (no site naming).
  - Rename `MakoIngestResult` → `NewsIngestResult`.
  - Change `NewsItemHashInput.source`, `NewNewsItemToStore.source`, and result `source` from `"mako-channel12"` to `string`.
- [x] Step 2: Keep Mako-specific knowledge inside the scraper adapter
  - Update `PwMakoScraper` to implement the new generic `NewsScraperPort` and provide `source = "mako-channel12"` internally.
  - Ensure URL/DOM selectors remain in `PwMakoScraper` only.
- [x] Step 3: Make app layer entry points site-agnostic
  - Rename `src/app/cron/makoIngestCron.ts` → `src/app/cron/newsIngestCron.ts` (or similar).
  - Rename `src/app/cli/makoIngestCli.ts` → `src/app/cli/newsIngestCli.ts` (or similar).
  - Update logs from `*:mako:*` → `*:news:*` and include `{ source: result.source }` for per-source observability.
- [x] Step 4: Update DI container wiring to generic names
  - Update `src/app/di/container.ts` exports/fields from `ingest.mako` → `ingest.news`.
  - Replace `readMakoConfig/MAKO_ENV` with site-agnostic config (see next step).
- [x] Step 5: Rename site-agnostic config helpers (remove MAKO_* env key usage)
  - Replace `src/modules/news-ingestion/public/makoEnv.ts` with a site-agnostic config module (e.g. `ingestionEnv.ts`).
  - Replace `MAKO_ENV.*` with generic keys (e.g. `INGEST_CRON_SCHEDULE`, `SCRAPER_HEADLESS`, `SCRAPER_SLOWMO_MS`, etc.).
  - Update CLI behavior that sets env vars to use the new generic keys.
- [x] Step 6: Update tests and docs
  - Update `src/modules/news-ingestion/tests/MakoIngestOrch.test.ts` to the new names and expectations.
  - Update `docs/*` to remove Mako from the ingestion core narrative; keep Mako only in scraper-specific sections.
- [x] Step 7: Sanity checks
  - Run unit tests.
  - Ensure `grep -i mako src/` only matches scraper adapter files (and possibly filenames in adapters).

## Completed
- Date completed: 2026-01-10
- Deviations:
  - Ran tests via `npm test` (no `pnpm` available in this environment).
  - Updated log namespaces to `*:news:*` and env vars to `INGEST_*` to remove all non-scraper “mako” coupling.
- Follow-ups:
  - Consider adding a second scraper adapter to validate multi-source wiring (DI should be the only change point).

## Files to Modify/Create
- `src/modules/news-ingestion/application/MakoIngestOrch.ts` - rename + make site-agnostic (no mako hardcoding)
- `src/modules/news-ingestion/ports/MakoScraperPort.ts` - rename + generalize + add `source`
- `src/modules/news-ingestion/dto/MakoScrapedItem.ts` - rename + generalize
- `src/modules/news-ingestion/dto/MakoIngestResult.ts` - rename + generalize
- `src/modules/news-ingestion/ports/NewsItemHasherPort.ts` - widen `source` type to `string`
- `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts` - widen `source` type to `string`
- `src/modules/news-ingestion/public/index.ts` - update exports to new names
- `src/modules/news-ingestion/public/makoEnv.ts` - replace with site-agnostic env/config module (new file)
- `src/modules/news-ingestion/adapters/PwMakoScraper.ts` - implement new port + own `source = "mako-channel12"`
- `src/modules/news-ingestion/tests/MakoIngestOrch.test.ts` - rename + update expectations/log assertions
- `src/app/di/container.ts` - rename wiring: `ingest.mako` → `ingest.news`
- `src/app/cron/makoIngestCron.ts` - rename + update references/logs
- `src/app/cli/makoIngestCli.ts` - rename + update references/logs
- `docs/modules/news-ingestion.md` - update narrative to site-agnostic
- `docs/ingestion/*.md` - update naming and log/event examples (keep Mako only in scraper adapter sections)
- `docs/system/DependencyInjection.md` - update container surface examples

## Testing Strategy (if needed)
- [ ] Unit: run `pnpm test` (or the repo’s configured test command) and ensure ingestion tests pass.
- [ ] Smoke: run the CLI in `--dry-run` mode and confirm output/logs include `{ source }` and do not contain `mako` outside scraper adapter implementation.

## Rollback Plan
- Revert the task branch / commits.
- If needed, restore the previous exports and filenames by checking out the last known good commit on `main`.

## Open Questions
- Should we **break** the env var names (`MAKO_*` → generic) immediately, or do you want a transition period?
  - Note: keeping back-compat aliases would require `MAKO_*` references outside the scraper layer, which conflicts with the goal.
- Should the new generic log namespace be `news` (e.g. `ingestion:news:*`) or something more explicit like `ingestion:ingest:*`?

