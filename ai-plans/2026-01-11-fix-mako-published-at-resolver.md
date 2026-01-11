# Task: Fix Mako `publishedAt` (timezone-aware + midnight rollover) via extracted adapter

## Context
- Ticket/Request: Fix `published_at` coming in empty; implement midnight rollover rule for Mako drawer time (`SEL_TIME = ".mc-message-footer__time"`).
- Related docs:
  - `docs/ingestion/Scraping.md` (publish time parsing + timezone nuance)
  - `docs/ingestion/FailureModes.md` (timezone mismatch mitigation guidance)
  - `docs/system/DependencyInjection.md` (composition root rules)

## Objective
Ensure `PwMakoScraper` produces a correct `publishedAt` ISO timestamp derived from the on-page `HH:mm` in Israel time (`Asia/Jerusalem`), including the midnight rollover rule:

- If the scraped time is between **23:00–23:59** and the current time in Israel is after midnight (**00:xx**), treat the publication date as **yesterday**.
- Example: now `00:25` + scraped `23:55` → timestamp for **yesterday 23:55**.

This must work correctly across month boundaries and varying month lengths.

## Technical Approach
- Introduce a dedicated **published-at resolver** port + adapter inside `news-ingestion`:
  - Port: `PublishedAtResolverPort` (module contract).
  - Adapter: `PublishedAtResolver` (timezone-aware implementation using a third-party date library; behavior determined by configured timezone).
- Inject the resolver into `PwMakoScraper` so the scraper stays infrastructure-only but delegates time interpretation to a focused dependency.
- Use `luxon` to:
  - Read “now” in `Asia/Jerusalem`.
  - Combine Israel “today” with scraped `HH:mm`.
  - Apply the **23:xx + now 00:xx → minus 1 day** rollover using date arithmetic that correctly handles month boundaries.
- Improve robustness of time extraction by matching the first `HH:mm` pattern in the time element text (keeps behavior stable if extra whitespace/markers appear).
- Add unit tests for the resolver with an injected `now()` provider for deterministic midnight-boundary behavior.

## Implementation Steps
- [x] Step 1: Add `PublishedAtResolverPort` to `src/modules/news-ingestion/ports/` (documented public contract).
- [x] Step 2: Add `PublishedAtResolver` adapter using `luxon` with:
  - `resolveIsoOrNull(timeText: string): string | null`
  - explicit `Asia/Jerusalem` zone handling
  - rollover rule (23:xx + now 00:xx → yesterday)
  - optional injected `now()` for tests
- [x] Step 3: Wire resolver into `PwMakoScraper` and remove the inline `parseTodayTimeToIsoOrNull` helper.
- [x] Step 4: Update DI wiring (`src/app/di/container.ts`) to instantiate and pass the resolver to `PwMakoScraper`.
- [x] Step 4b: Add operational logs around time extraction + resolution to debug `publishedAt` issues.
- [x] Step 5: Add unit tests for the resolver covering:
  - regular same-day parsing (e.g. now 12:00, scraped 10:52)
  - midnight rollover (now 00:25, scraped 23:55 → yesterday)
  - month boundary rollover (e.g. now 2026-02-01 00:05, scraped 23:55 → 2026-01-31 23:55)
- [ ] Step 6: Update docs to reflect the new adapter and behavior:
  - `docs/ingestion/Scraping.md`
  - `docs/ingestion/FailureModes.md`
  - [x] Step 7: Extract shared date/time formatting rules into `src/shared/` and refactor all timestamp formatting to use it.
  - Implement a shared formatter port+adapter) that outputs canonical UTC ISO with milliseconds (`YYYY-MM-DDTHH:mm:ss.SSSZ`).
  - Update all production code that currently calls `toISOString()` / Luxon `toISO()` for persistence-facing timestamps to use the shared formatter.

## Files to Modify/Create
- `src/modules/news-ingestion/ports/PublishedAtResolverPort.ts` - new port contract.
- `src/modules/news-ingestion/adapters/PublishedAtResolver.ts` - new adapter implementation (timezone-aware; timezone-driven behavior).
- `src/modules/news-ingestion/adapters/PwMakoScraper.ts` - inject resolver + delegate publishedAt derivation.
- `src/app/di/container.ts` - DI wiring for resolver.
- `src/modules/news-ingestion/tests/PublishedAtResolver.test.ts` - new unit tests.
- `package.json` - add `luxon` dependency.
- `docs/ingestion/Scraping.md` - update parsing section to reference resolver.
- `docs/ingestion/FailureModes.md` - update mitigation to match implementation.
- `src/shared/*` - shared timestamp formatting abstraction (new).
- `src/modules/*` - refactors to route all timestamp formatting through shared code (as needed).

## Testing Strategy (if needed)
- [ ] Run unit tests: `npm test`
- [ ] (Optional) Run ingestion CLI once to confirm non-null `publishedAt`: `npm run dev:cli:ingest -- --dry-run`

## Rollback Plan
- Revert the commits on branch `fix/mako-published-at-resolver`.
- Restore the previous inline helper in `PwMakoScraper.ts` and remove the resolver wiring.

## Open Questions
- Should the rollover rule be **strictly** “23:xx + now 00:xx” (as requested), or should we generalize to “if computed timestamp is in the future vs now”? Current plan implements the requested strict rule.

