# API

## Purpose / scope

This folder documents the runtime REST API exposed by the Express entry point:

- `src/app/api/server.ts`

Entry-point rule reminder: route handlers are infrastructure-only; they validate input and call orchestrators from the DI container.

```mermaid
flowchart LR
  subgraph API[Express_API_routes]
    Filters[/api/filters]
    NewsByIds["GET_/api/news-items/by-ids"]
    Digests[/api/digests]
    LlmCfg["/api/llm-config"]
    Llms["/api/llms_and_models"]
  end

  DI[buildContainer]

  subgraph Modules[UseCases_by_module]
    Filtering[news_filtering_orchestrators]
    Ingestion[news_ingestion_orchestrators]
    Publishing[publishing_orchestrators]
  end

  subgraph DB[SQLite_tables]
    FiltersTbl[filters]
    NewsTbl[news_items]
    DigestsTbl[digests]
    LlmCfgTbl[llm_config]
    LlmsTbl[llms]
    ModelsTbl[llm_models]
  end

  Filters --> DI --> Filtering --> FiltersTbl
  NewsByIds --> DI --> Ingestion --> NewsTbl
  Digests --> DI --> Publishing --> DigestsTbl
  LlmCfg --> DI --> Publishing --> LlmCfgTbl
  Llms --> DI --> Publishing --> LlmsTbl
  Llms --> DI --> Publishing --> ModelsTbl
```

## Endpoints

### `GET /api/llm-config`

Returns the current LLM configuration used by the publishing flow.

Notes:
- The API contract still exposes `model` as a **model name string** (e.g. `gemini-2.0-flash-lite`).
- Internally, the system persists the selected model as a **model id** (`llm_config.model_id`) linked to `llm_models`.

**Response shape**

- `model` — Model name string (e.g. Gemini model id).
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

### `POST /api/llms`

Creates an LLM provider.

**Request body**

- `name` — non-empty string (unique).
- `alias` — non-empty string.

**Response shape**

Returns the created row:
- `id` — integer.
- `name` — string.
- `alias` — string.

### `GET /api/llms`

Returns all configured LLM providers.

**Response shape**

Array of:
- `id` — integer.
- `name` — string.
- `alias` — string.

### `PUT /api/llms/:id`

Updates an LLM provider.

**Request body**

At least one of:
- `name` — non-empty string.
- `alias` — non-empty string.

### `DELETE /api/llms/:id`

Deletes an LLM provider.

Notes:
- Deletion is rejected if the current `llm_config` references any model under that LLM.

### `POST /api/llm-models`

Creates a model linked to an LLM.

**Request body**

- `llmId` — positive integer (must reference an existing LLM).
- `name` — non-empty string (unique).

**Response shape**

Returns the created row:
- `id` — integer.
- `llm_id` — integer (LLM id).
- `name` — string.

### `GET /api/llms/:id/models`

Returns models linked to a specific LLM provider.

**Response shape**

Array of:
- `id` — integer.
- `llm_id` — integer.
- `name` — string.

### `PUT /api/llm-models/:id`

Updates a model.

**Request body**

At least one of:
- `llmId` — positive integer.
- `name` — non-empty string.

### `DELETE /api/llm-models/:id`

Deletes a model.

Notes:
- Deletion is rejected if the current `llm_config` references that model.

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
- `filtered`
- `filters_ids`
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
    "filtered": 1,
    "filters_ids": [3],
    "media_type": "video",
    "media_url": "https://example.com/video.mp4"
  }
]
```

### `GET /api/filters`

Returns all configured regex filters.

**Response shape**

Array of:
- `id` — integer
- `created_at` — ISO string
- `updated_at` — ISO string
- `name` — string (unique)
- `pattern` — string (regex source)

### `POST /api/filters`

Creates a regex filter.

**Request body**

- `name` — non-empty string (unique)
- `pattern` — non-empty string (JavaScript regex source; validated with Unicode flag)

### `PUT /api/filters/:id`

Updates a regex filter.

**Request body**

At least one of:
- `name` — non-empty string
- `pattern` — non-empty string

### `DELETE /api/filters/:id`

Deletes a regex filter.

