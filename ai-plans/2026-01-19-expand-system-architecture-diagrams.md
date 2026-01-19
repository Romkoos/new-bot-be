# Task: Expand system architecture diagrams (Option B)

## Context
- Ticket/Request: “More information” for the system architecture diagram; user selected **Option B**.
- Current docs:
  - `docs/README.md` (docs index)
  - `docs/Overview.md` (entry points + DI + orchestrators)
  - `docs/system/Lifecycle.md` (API, Cron, CLI lifecycle + boot sequence)
  - `docs/Architecture.md` (high-level architecture; note: contains a stale statement about “no database”)

## Objective
Create a higher-signal architecture doc by:
- Keeping a **big picture** diagram.
- Adding **two small diagrams**:
  - API request flow
  - PM2 boot sequence flow
- Linking the doc from `docs/README.md`.

## Technical Approach
- Add `docs/system/SystemArchitectureDiagram.md` (if missing on `main`) with:
  - Brief purpose + “where in code” pointers (no code excerpts).
  - **Diagram 1**: Big picture structure (Entry points → DI container → orchestrators → adapters/externals).
  - **Diagram 2**: API request flow (Browser UI → API route → orchestrator → adapters → response).
  - **Diagram 3**: Boot sequence flow (PM2 start → boot sequence entry point → boot orchestrator → health → ingest → publish).
- Mermaid constraints:
  - Use `flowchart LR` only.
  - Keep each diagram < ~15 nodes.
  - Avoid quotes and special characters in labels; no slashes in node labels.

## Implementation Steps
- [x] Step 1: Create or update `docs/system/SystemArchitectureDiagram.md`
  - Include 3 diagrams as described above.
  - Ensure health path reflects reality (health uses system time, not SQLite).
- [ ] Step 2: Update docs index
  - Add a link under `docs/README.md` → **System** section.

## Files to Modify/Create
- `docs/system/SystemArchitectureDiagram.md` - create/update with 3 Mermaid diagrams
- `docs/README.md` - link the doc under System
- `ai-plans/2026-01-19-expand-system-architecture-diagrams.md` - this plan

## Testing Strategy (if needed)
- [ ] Verify Mermaid renders in Cursor/GitHub preview (no syntax errors).

## Rollback Plan
- Revert the commit(s) that add/modify the docs file and index link.

## Open Questions
- `docs/Architecture.md` currently says “There is no database in this demo.” This is now outdated (SQLite is used). Should we fix that in the same docs change, or keep this task strictly diagram-focused?

