# Failure modes and troubleshooting

## Purpose / scope

This document describes:

- The most likely ways ingestion can fail.
- How those failures surface (exceptions + logs).
- Practical troubleshooting steps.

## Where to look first

Start with log events:

- `cron:news:ingestion:error { error: ... }`
- `cli:news:ingestion:error { error: ... }`

Then map the error to the subsystem:

- Scraping (Playwright): `PwMakoScraper`
- Hashing: `Sha256Hasher` (rare to fail)
- Storage: `SqliteNewsRepo`

## Scraping failures (Playwright)

### Browser binaries not installed

Symptom:

- Error like “Executable doesn't exist” or Playwright cannot find Chromium.

Fix:

- Install once in your environment:
  - `npx playwright install`

This repo intentionally does not auto-run installation.

### Navigation timeout

Where:

- `page.goto(URL, { timeout: 15000 })`

Symptoms:

- `TimeoutError` during goto or during `waitForSelector`.

Root causes:

- slow network
- blocked by bot protection
- site outage

Mitigations:

- Run headful to observe behavior:
  - CLI: `--headful`
  - Or set `INGEST_SCRAPER_HEADLESS=false`
- Increase timeouts (code change) if the site is consistently slower.
- Use persistent context:
  - `INGEST_USER_DATA_DIR=...`

### Drawer button not found

Where:

- `findDrawerButtonStrict` scanning `.mc-drawer__btn` across frames

Symptoms:

- Error message like:
  - `Drawer button not found (.mc-drawer__btn) within 10000ms. Frames: ...`

Root causes:

- site UI changed (selector no longer valid)
- page is not the expected page (redirected)
- bot protection page rendered instead of site

Mitigations:

- Run headful and inspect the page.
- Update selectors in `PwMakoScraper.ts` if the site changed.
- Use persistent context / real Chrome channel:
  - `INGEST_USER_DATA_DIR=...`
  - `INGEST_CHROMIUM_CHANNEL=chrome`

### Items selector returns zero nodes

Where:

- `SEL_NEWS_ITEM = ".desktop-drawer-news .mc-extendable-text__content > div > div"`

Symptoms:

- scraper returns `[]`
- orchestrator logs `ingestion:news:scraped { count: 0 }`

Root causes:

- site changed DOM structure
- drawer container exists but items are different nodes

Mitigations:

- Update selector constants in scraper.

### Time parsing returns null

Where:

- `parseTodayTimeToIsoOrNull`

Symptoms:

- Items stored with `published_at` null even when UI shows time.

Root causes:

- time text not matching `HH:mm`
- time in a different element or includes extra text

Mitigations:

- Adjust extraction logic to normalize time text before parsing.

### Timezone mismatch (today vs site)

Symptom:

- Around midnight, `publishedAt` can end up on the “wrong day” if the Node process timezone differs from Israel.

Reason:

- `parseTodayTimeToIsoOrNull` uses Node’s `Date()` to derive “today”.

Mitigation options (code changes):

- Inject a time source/clock.
- Use a timezone-aware date library and interpret `HH:mm` in `Asia/Jerusalem`.

## Hashing failures

Hashing is local CPU work and typically does not fail unless:

- input is not serializable (not the case here; input is primitives)
- Node crypto is unavailable (very unlikely)

If hashes change unexpectedly across runs:

- check normalization rules in `NewsIngestOrch`
- check canonicalization in `Sha256Hasher`
- avoid changing `source` or normalization without a migration plan

## Storage failures (SQLite)

### Directory does not exist

This is mitigated by:

- `ensureSqliteParentDirectory(sqlitePath)` which `mkdir -p` the directory.

If you still see “cannot open database”:

- check file permissions
- check if path points to a directory you cannot create/write

### Corrupt database

Symptoms:

- SQLite errors on queries/inserts.

Mitigations:

- move aside the DB file
- start with a fresh DB
- restore from backup if this is production data

### Uniqueness collisions / storedCount lower than newItemsCount

Because `insertMany` uses `INSERT OR IGNORE`:

- some rows may be ignored due to unique hash collisions
- `storedCount` can be less than `newItemsCount`

This can happen if:

- two items in a batch share the same hash (should be rare but possible with identical content)

Mitigation options:

- dedupe within the orchestrator by hash before calling `insertMany` (code change)

## Entry-point failures

### Cron keeps running after errors

Cron intentionally logs errors and continues.

If you need:

- retries, backoff, circuit breakers

Implement them at the cron entry point (infrastructure), not in the orchestrator.

### CLI does not exit

CLI explicitly calls `process.exit(0/1)`.

If the process still hangs, likely causes are:

- an unclosed Playwright browser/context (should not happen; scraper closes in `finally`)
- external handles in your environment

## “Nothing stored” is not always a failure

If `newItemsCount` is 0 and you see:

- `ingestion:news:early-exit:no-new-items`

That means idempotency worked and the system found nothing new to store.

