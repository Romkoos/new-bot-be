# Hashing (normalization + deterministic SHA-256)

## Purpose / scope

This document explains:

- What constitutes a “stable hash” for ingestion items.
- Where normalization happens and why.
- How the SHA-256 hasher canonicalizes its input.
- How hash stability relates to idempotency and deduplication.

## Where it lives

- Orchestrator normalization:
  - `src/modules/news-ingestion/application/NewsIngestOrch.ts`
- Hashing port:
  - `src/modules/news-ingestion/ports/NewsItemHasherPort.ts`
- SHA-256 adapter:
  - `src/modules/news-ingestion/adapters/Sha256Hasher.ts`

## Goals

### Determinism

Given the same normalized content, hashing must always return the same value.

### Stability across runs

Re-running ingestion:

- must produce the same hashes for previously ingested items
- must not create duplicates in storage

### No hashing in scraper

Scraping and hashing are separated:

- scraper returns normalized scrape output only
- orchestrator coordinates normalization + hashing
- hasher adapter owns the algorithm

## Canonical hash input

Hash input is defined by `NewsItemHashInput`:

- `source: string` (provided by the configured scraper adapter)
- `rawText: string`
- `publishedAt: string | null`

The inclusion of `source` prevents accidental collisions if multiple sources are introduced later.

## Normalization rules (owned by the orchestrator)

Normalization is performed in `NewsIngestOrch` before calling the hasher:

### `rawText`

Normalization:

- trim leading/trailing whitespace
- collapse any whitespace sequence (`\\s+`) into a single space

Effect:

- visually identical content from the page yields identical hashes even if spacing differs.

### `publishedAt`

Normalization:

- `null` remains `null`
- otherwise:
  - trim
  - parse as `Date`
  - return `toISOString()`
  - if parsing fails, treat as `null`

Effect:

- ensures hasher always receives either a valid ISO timestamp or null.

### Filtering empty text

After normalization, items with empty `rawText` are dropped.

This prevents:

- hashing empty content
- inserting empty content into the DB

## Canonicalization in the hasher adapter

The SHA-256 adapter canonicalizes input by JSON-stringifying a stable key order:

```json
{ "source": "...", "rawText": "...", "publishedAt": "..." }
```

This avoids instability from key ordering differences.

## Hash output

The adapter returns:

- `hex`-encoded SHA-256 digest (lowercase)

This string is used as:

- the deduplication key in SQLite (UNIQUE(hash))
- the primary identifier for “have we seen this item before?”

## Relationship to idempotency

Idempotency depends on:

1. The orchestrator producing stable hashes for stable content.
2. Filtering by existing hashes before storing.
3. The DB enforcing uniqueness as a backstop (`INSERT OR IGNORE` + UNIQUE).

If any of the normalization rules change, hashes may change and the system can re-ingest old items as “new”.

If you need to change normalization in the future, treat it as a migration:

- version the hash input, or
- keep compatibility with old hashes, or
- accept re-ingestion and handle it explicitly.

