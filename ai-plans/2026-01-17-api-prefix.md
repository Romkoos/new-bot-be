# Task: Prefix all REST endpoints with `/api`

## Context
- Ticket/Request: Digests API is currently exposed from the root; all APIs must be prefixed with `api/` (e.g. `GET /api/digests`).
- Related docs:
  - `docs/api/README.md` (documented endpoints)
  - `docs/system/Lifecycle.md` (mentions example API request paths)
  - `docs/Overview.md` (lists API endpoint examples)
  - `docs/Architecture.md` (API flow example)

## Objective
Update the Express API entry point so that **all** HTTP endpoints are served under the `/api` prefix (no root-level REST endpoints), and update documentation accordingly.

## Technical Approach
- Keep route modules (`src/app/api/routes/*.ts`) unchanged (they define paths like `/digests`, `/news-items/...`).
- Apply the prefix at the **composition / entry point** layer by mounting all routes under `/api` in `src/app/api/server.ts`.
- Update docs to reflect new paths.

## Implementation Steps
- [x] Step 1: Add `/api` prefix in API entry point
  - [x] Mount each route with a base path: `app.use("/api", <route>)`
  - [x] Verify resulting paths:
    - `GET /api/digests`
    - `GET /api/news-items/by-ids?ids=1,2,3`
- [x] Step 2: Update docs to match runtime behavior
  - [x] `docs/api/README.md` — change endpoints to `/api/...`
  - [x] `docs/system/Lifecycle.md` — update example request paths
  - [x] `docs/Overview.md` — update endpoint examples
  - [x] `docs/Architecture.md` — update API flow example
- [ ] Step 3: Validation
  - [ ] Quick grep to ensure no remaining doc references to root endpoints (`GET /digests`, `GET /news-items/...`) unless explicitly called out as legacy.
  - [ ] Run `npm test` (Vitest) to ensure nothing regressed.

## Files to Modify/Create
- `src/app/api/server.ts` - mount routes under `/api`
- `docs/api/README.md` - update endpoint paths
- `docs/system/Lifecycle.md` - update example request path
- `docs/Overview.md` - update endpoint list / examples
- `docs/Architecture.md` - update API flow example
- `ai-plans/2026-01-17-api-prefix.md` - this plan

## Testing Strategy (if needed)
- [ ] Unit tests: `npm test`
- [ ] Manual smoke (optional):
  - [ ] Start API: `npm run dev`
  - [ ] `GET /api/digests`
  - [ ] `GET /api/news-items/by-ids?ids=1,2,3`

## Rollback Plan
- Revert the task commit(s) and redeploy.
- If needed for compatibility, temporarily re-expose legacy routes by mounting the same routers at both `/` and `/api` (explicitly documented as legacy).

## Open Questions
- Should we **hard break** legacy root routes (`/digests`, `/news-items/...`) immediately (recommended per request), or keep them temporarily as deprecated aliases?

