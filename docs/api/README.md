# API

## Purpose / scope

This folder documents the runtime REST API exposed by the Express entry point:

- `src/app/api/server.ts`

Entry-point rule reminder: route handlers are infrastructure-only; they validate input and call orchestrators from the DI container.

## Endpoints

### `GET /api/llm-config`

Returns the current LLM configuration used by the publishing flow.

**Response shape**

- `model` — Gemini model id string.
- `instructions` — prompt instructions string.
- `updatedAt` — ISO timestamp string.

**Example**

```json
{
  "model": "gemini-2.0-flash-lite",
  "instructions": "...",
  "updatedAt": "2026-01-17T00:00:00.000Z"
}
```

Failure modes:
- If the `llm_config` row does not exist, this endpoint returns `500` (system is not configured).
- If the row exists but is invalid (empty strings), this endpoint returns `500`.

### `PUT /api/llm-config`

Creates or updates the LLM configuration used by the publishing flow.

If the config row does not exist yet, it will be created.

**Request body**

- `model` — non-empty string.
- `instructions` — non-empty string.

**Response shape**

Same as `GET /api/llm-config`.

**Example**

```json
{
  "model": "gemini-2.0-flash-lite",
  "instructions": "Your instructions here...",
  "updatedAt": "2026-01-17T00:00:00.000Z"
}
```

### `GET /api/digests`

Returns an array of digests.

**Response shape**

Each element is a subset of the SQLite `digests` table, returning **all columns except**:
- `source_items_count`
- `source_news_texts_json`
- `publisher_external_id`

Returned fields:
- `id`
- `created_at`
- `updated_at`
- `digest_text`
- `is_published`
- `source_item_ids_json`
- `llm_model`
- `published_at`

**Example**

```json
[
  {
    "id": 12,
    "created_at": "2026-01-14T10:00:00.000Z",
    "updated_at": "2026-01-14T10:00:05.000Z",
    "digest_text": "...\n",
    "is_published": 1,
    "source_item_ids_json": "[1,2,3]",
    "llm_model": "gemini-1.5-pro",
    "published_at": "2026-01-14T10:00:05.000Z"
  }
]
```

### `GET /api/news-items/by-ids?ids=1,2,3`

Returns an array of news item objects (or `null`), in the **same order** as the input ids.

**Query params**

- `ids`: comma-separated list of positive integer ids, e.g. `1,2,3`

**Response shape**

The response array has the **same length** as the input ids array.

For each requested id:
- if found, the corresponding element is an object from the SQLite `news_items` table including **all columns except**:
  - `hash`
  - `payload_json`
- if not found, the corresponding element is `null`

Returned fields (when found):
- `id`
- `source`
- `raw_text`
- `published_at`
- `scraped_at`
- `processed`
- `media_type`
- `media_url`

**Example**

Request:

- `GET /api/news-items/by-ids?ids=1,999,2`

Response:

```json
[
  {
    "id": 1,
    "source": "mako",
    "raw_text": "....",
    "published_at": "2026-01-14T09:12:00.000Z",
    "scraped_at": "2026-01-14T09:15:00.000Z",
    "processed": 0,
    "media_type": null,
    "media_url": null
  },
  null,
  {
    "id": 2,
    "source": "mako",
    "raw_text": "....",
    "published_at": null,
    "scraped_at": "2026-01-14T09:15:00.000Z",
    "processed": 1,
    "media_type": "video",
    "media_url": "https://example.com/video.mp4"
  }
]
```

