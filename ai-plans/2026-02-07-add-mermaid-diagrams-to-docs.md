# Task: Add Mermaid diagrams to documentation

## Context
- Ticket/Request: check all documentation and README files; add Mermaid diagrams where relevant.
- Related docs:
  - `docs/README.md`
  - `docs/Overview.md`
  - `docs/Architecture.md`
  - `docs/system/SystemArchitectureDiagram.md`
  - `docs/system/Lifecycle.md`
  - `docs/system/DependencyInjection.md`
  - `docs/ingestion/*`
  - `docs/api/README.md`
  - `docs/modules/*`
  - Root `README.md`

## Objective
Add **balanced, high-signal** Mermaid diagrams (default: `flowchart LR`) across the docs to make:
- boundaries and ownership clearer (app entry points vs modules),
- runtime flows easier to follow (API/Cron/CLI),
- cross-module interactions explicit (publishing + filters + ingestion).

## Technical Approach
- Prefer `flowchart LR` as the default; use sequence diagrams only where actor timing is the clearest representation.
- Keep diagrams small and non-duplicative; link to `docs/system/SystemArchitectureDiagram.md` for canonical “big picture”.
- Follow Mermaid constraints:
  - no spaces in node IDs,
  - quote labels when they contain special characters,
  - no custom styling.

## Implementation Steps
- [ ] Step 0: Branch prep (update `main`, create a new task branch from it).
- [ ] Step 1: Add “map/overview” diagrams
  - [ ] `README.md` (runtime shape at a glance)
  - [ ] `docs/README.md` (reading order map)
  - [ ] `docs/Overview.md` (boundaries + runtime flow)
  - [ ] `docs/Architecture.md` (boundaries + “no deep imports”)
- [ ] Step 2: Add system deep-dive diagrams
  - [ ] `docs/system/DependencyInjection.md` (container wiring)
  - [ ] `docs/system/Lifecycle.md` (PM2 + boot-sequence + cron_restart model)
- [ ] Step 3: Add ingestion topic diagrams
  - [ ] `docs/ingestion/Orchestration.md` (step-by-step flow with decision points)
  - [ ] `docs/ingestion/EntryPoints.md` (Cron vs CLI participation)
  - [ ] `docs/ingestion/Config.md` (env → config → DI → adapter instantiation)
  - [ ] `docs/ingestion/Scraping.md` (scrape algorithm)
  - [ ] `docs/ingestion/Storage.md` (dedup + write model)
- [ ] Step 4: Add module/API diagrams + fill missing module docs
  - [ ] `docs/modules/publishing.md` (PublishDigest flow, incl. filtering)
  - [ ] `docs/modules/news-ingestion.md` (compact orchestrator flow)
  - [ ] `docs/modules/health.md` (tiny module wiring/contract flow)
  - [ ] Create `docs/modules/news-filtering.md` (ownership + orchestrators + contracts + integration)
  - [ ] Create `docs/modules/news-pipeline.md` (boot sequencing ownership + integration)
  - [ ] Update `docs/modules/README.md` (include new modules)
  - [ ] `docs/api/README.md` (endpoint groups → orchestrators → tables)
  - [ ] `src/modules/news-pipeline/README.md` (diagram or link to docs)
- [ ] Step 5: Consistency pass
  - [ ] Link hygiene: new docs reachable from indices (`docs/README.md`, `docs/modules/README.md`)
  - [ ] Mermaid render sanity check (no syntax issues)

## Files to Modify/Create
- Modify:
  - `README.md`
  - `docs/README.md`
  - `docs/Overview.md`
  - `docs/Architecture.md`
  - `docs/system/DependencyInjection.md`
  - `docs/system/Lifecycle.md`
  - `docs/ingestion/Orchestration.md`
  - `docs/ingestion/EntryPoints.md`
  - `docs/ingestion/Config.md`
  - `docs/ingestion/Scraping.md`
  - `docs/ingestion/Storage.md`
  - `docs/modules/publishing.md`
  - `docs/modules/news-ingestion.md`
  - `docs/modules/health.md`
  - `docs/modules/README.md`
  - `docs/api/README.md`
  - `src/modules/news-pipeline/README.md`
- Create:
  - `docs/modules/news-filtering.md`
  - `docs/modules/news-pipeline.md`

## Testing Strategy (docs)
- Preview the edited markdown files to ensure Mermaid blocks render.
- Verify internal links are correct and discoverable from doc indices.

## Rollback Plan
Revert the docs commit(s) or remove the added Mermaid blocks from affected markdown files.

## Open Questions
- None.

