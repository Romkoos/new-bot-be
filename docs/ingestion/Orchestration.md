# Ingestion orchestration (use-case flow + idempotency)

## Purpose / scope

This document explains the **exact runtime flow** owned by the ingestion orchestrator:

- Which steps run, in which order, and why.
- How idempotency is achieved.
- Where normalization and hashing happen (and where they must *not* happen).
- How “dry-run” works.

## Where it lives

- Orchestrator: `src/modules/news-ingestion/application/NewsIngestOrch.ts`
- Ports used by orchestrator:
  - `src/modules/news-ingestion/ports/NewsScraperPort.ts`
  - `src/modules/news-ingestion/ports/NewsItemHasherPort.ts`
  - `src/modules/news-ingestion/ports/NewsItemsRepositoryPort.ts`

## Flow ownership and boundary rules

### Golden rule: orchestrator owns ordering

Only the orchestrator answers:

> “What happens, and in what order?”

Entry points (`src/app/*`) may only trigger this orchestrator and must not:

- Scrape
- Hash
- Query storage
- Decide filtering rules
- Decide persistence behavior

### Public API rule

Other code may import only from:

- `src/modules/news-ingestion/public/index.ts`

No deep imports into module internals from `src/app/*` or other modules.

## Step-by-step runtime flow

The orchestrator implements this exact sequence:

### 0) Start + timing

It captures wall-clock start time and logs:

- `ingestion:news:start` with `{ dryRun }`

### 1) Scrape (via scraper port)

Call:

- `scraper.scrapeFirstFive()`

Constraints:

- The scraper returns **normalized scrape output only**:
  - it must not compute hashes
  - it must not access SQLite

On success, orchestrator logs:

- `ingestion:news:scraped` with `{ count }`

### 2) Normalize for hash stability (in orchestrator)

The orchestrator is responsible for minimal canonicalization *before hashing*.

For each scraped item:

- `rawText` is normalized by:
  - trim
  - collapse whitespace (`\s+` -> single space)
- `publishedAt` is normalized to:
  - ISO string (`toISOString()`) **or**
  - `null`

Important:

- Empty text is filtered out after normalization.

### 3) Hash (via hashing port)

Hashing is delegated to:

- `hasher.hashNormalized(input)`

The orchestrator does **not** own the hashing algorithm; it only ensures the input is stable.

Hash input includes:

- `source` (string provided by the configured scraper adapter)
- normalized `rawText`
- normalized `publishedAt` (ISO or null)

### 4) Filter by existing hashes (via repository port)

The orchestrator asks persistence which hashes already exist:

- `repository.findExistingHashes(hashes)`

Then it filters out duplicates in-memory:

- keep only items whose hash is not in the returned set

It logs:

- `ingestion:news:filtered` with:
  - `source`
  - `existingCount`
  - `filteredOutCount`
  - `newItemsCount`

### 5) Early exit when no new items exist

If `newItemsCount === 0`:

- It logs: `ingestion:news:early-exit:no-new-items` with `{ source, durationMs }`
- Returns `NewsIngestResult` with:
  - `newItemsCount: 0`
  - `storedCount: 0`

This is a **successful** outcome. “Nothing to do” is not an error.

### 6) Convert to persistence payload

The orchestrator converts each new item to `NewNewsItemToStore`:

- `source: string` (provided by the configured scraper adapter)
- `hash`
- `rawText`
- `publishedAt`
- `payloadJson`: JSON string containing the normalized representation

### 7) Persist (unless dry-run)

If `dryRun`:

- It does not call `insertMany`
- It still returns a result with `newItemsCount` set correctly and `storedCount: 0`

If not dry-run:

- It calls `repository.insertMany(toStore)`
- `storedCount` is taken from the repository result

### 8) Done + summary

It logs a single summary line:

- `ingestion:news:done` with:
  - `source`
  - `dryRun`
  - `scrapedCount`
  - `newItemsCount`
  - `storedCount`
  - `durationMs`

It returns the same values as `NewsIngestResult`.

## Idempotency model (why duplicates are not created)

Idempotency is enforced at two layers:

### 1) Use-case filtering (business flow)

- Orchestrator filters out existing hashes before attempting to store.

### 2) Database uniqueness (safety net)

- SQLite schema enforces `UNIQUE(hash)`.
- Inserts are `INSERT OR IGNORE`.
- Even if the use-case misses a duplicate, the DB prevents a second row with the same `hash`.

Together, re-running ingestion must not create duplicates.

## Side effects

- Browser automation network activity (Playwright) during scrape.
- SQLite reads/writes during filtering and persistence.
- Structured logs written to stdout/stderr.

## Extension points

- Add new ingestion sources by introducing a new orchestrator (or a new module) that owns that flow.
- Add new storage backends by implementing `NewsItemsRepositoryPort`.
- Add new hashing algorithms by implementing `NewsItemHasherPort` (keeping deterministic behavior).

