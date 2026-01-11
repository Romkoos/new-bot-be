# Scraping (Playwright adapter: drawer click + first-5 extraction)

## Purpose / scope

This document explains how the Playwright scraper works:

- What it navigates to.
- Which selectors it depends on.
- How it “opens” the news drawer (strict).
- How it extracts the first 5 items efficiently.
- How it derives `publishedAt` from on-page `HH:mm`.

Scraping is **infrastructure only**. It must not:

- hash data
- access SQLite
- decide business filtering rules

## Where it lives

- Scraper port: `src/modules/news-ingestion/ports/NewsScraperPort.ts`
- Playwright adapter: `src/modules/news-ingestion/adapters/PwMakoScraper.ts`

## Target URL and selectors

The adapter scrapes:

- `https://www.mako.co.il/news-channel12`

Key selectors (constants in the adapter):

- Drawer button: `.mc-drawer__btn`
- News container: `.desktop-drawer-news`
- News items (within container): `.desktop-drawer-news .mc-extendable-text__content > div > div`
- Publish time: `.mc-message-footer__time`

If the site changes structure or class names, scraping may fail with selector errors.

## High-level algorithm

### `scrapeFirstFive()`

1. Create a Playwright browser context (persistent or non-persistent).
2. Open a new page.
3. `page.goto(URL)` using `waitUntil: "domcontentloaded"` and a timeout.
4. Find and click the drawer button `.mc-drawer__btn` (strict).
5. Wait for the news container `.desktop-drawer-news`.
6. Extract items in a single `evaluateAll` call and return normalized results.
7. Close page and context/browser in a `finally`.

## Browser context creation (`createCtx`)

The adapter supports two modes:

### 1) Persistent context (when `userDataDir` is set)

- Uses `chromium.launchPersistentContext(userDataDir, options)`
- Benefits:
  - reuses cookies/localStorage across runs
  - can improve reliability against bot protection

### 2) Regular context (default)

- Uses `chromium.launch(...)` then `browser.newContext(...)`

### Options passed into context

Regardless of mode, the adapter configures:

- `headless` (from env/config)
- optional `slowMo`
- optional `channel` (`chrome` | `msedge`)
- `userAgent`, `locale`, `timezoneId`
- `viewport: { width: 1280, height: 720 }`

Defaults inside the adapter (when env/config does not override):

- locale: `he-IL`
- timezone: `Asia/Jerusalem`
- user-agent: a desktop Chrome UA string

## Drawer open behavior (strict)

### Why the drawer click exists

The site’s “news drawer” UI is not always visible immediately. The adapter explicitly clicks the first `.mc-drawer__btn` it can find.

### How it finds the button: `findDrawerButtonStrict`

It scans **all frames** returned by `page.frames()`:

- Every `T_SCAN_MS` (250ms) until `T_CLICK_MS` (10s) deadline:
  - For each frame:
    - checks `frame.locator(SEL_DRAWER_BTN).count()`
    - if `count > 0`, returns that locator and frame URL

If no drawer button is found, it throws:

- `Drawer button not found (.mc-drawer__btn) within <timeout>ms. Frames: <urls...>`

This is a **hard failure** (by requirement).

Common root causes:

- site changed
- content loaded differently (A/B layout)
- bot protection / redirect page (button never exists)

## Waiting for the news container

After clicking the drawer button, the adapter waits for:

- `.desktop-drawer-news`

This is the “ready” signal that the content is present.

## Extraction strategy (performance)

### Why `evaluateAll`

Playwright round trips are expensive. Extracting each item individually causes noticeable delays.

The adapter extracts all item data in a single in-browser evaluation:

- `locator.evaluateAll((nodes) => ...)`

### What it extracts

For the first 5 DOM nodes:

- `timeText`: text of `.mc-message-footer__time` (if present)
- `text`: content of the node with the time element removed

Implementation details:

- It clones each element, removes `.mc-message-footer__time`, then reads `textContent`.
- It trims the resulting text.
- It returns only items with non-empty text.

### First-5 selection rule

Extraction uses:

- `nodes.slice(0, 5)`

This is the “first five items from the beginning of the DOM tree” requirement.

## Publish time parsing (`PublishedAtResolver`)

The site provides only an `HH:mm` string.

Parsing strategy:

- The scraper extracts the time string from `.mc-message-footer__time`.
  - Important: the time element is not always a direct descendant of the per-item node, so extraction walks up the DOM to find the correct container.
- The extracted time text is resolved by `PublishedAtResolver` (timezone-aware).
  - It interprets `HH:mm` in a configured timezone (default: `Asia/Jerusalem`).
  - It applies the midnight rollover rule:
    - if scraped time is `23:xx` and the current time in that timezone is `00:xx`, the publish date is treated as **yesterday**.
- The resulting timestamp is formatted via the shared `UtcIsoTimestampFormatterPort` into canonical UTC ISO with milliseconds:
  - `YYYY-MM-DDTHH:mm:ss.SSSZ`

If parsing fails, returns `null`.

### Important nuance: timezone source of truth

The timezone source of truth is the resolver configuration (default: `Asia/Jerusalem`), not Node’s process timezone.

Even though Playwright context has `timezoneId`, the Node process timezone might differ.

If you run ingestion on a server with a different timezone than Israel, “today” could mismatch around midnight.

This is mitigated by the resolver being timezone-aware and by using the shared timestamp formatter for consistent output.

For debugging, the scraper emits logs:

- `scraper:mako:extracted` (timeTexts, empty counts)
- `scraper:mako:publishedAt:resolved` (`timeText` → `publishedAt`)

## Outputs and constraints

The adapter returns `ScrapedNewsItem[]`:

- `text: string`
- `publishedAt: string | null` (ISO or null)

It performs no hashing and does not access the DB.

