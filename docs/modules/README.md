# Modules (deep dives)

## Purpose / scope

This folder documents each business module under `src/modules/` in a consistent way:

- What the module owns.
- Its Public API and contracts.
- Its orchestrators (use-cases) and their flows.
- Its ports and adapters (hexagonal boundaries).
- How the module is wired into the runtime (DI + entry points).

## Modules in this repo

- [`health`](./health.md)
- [`news-ingestion`](./news-ingestion.md)
- [`publishing`](./publishing.md)

## How to read module docs

Each module deep dive follows the same structure:

- Purpose and ownership
- Public API (what other layers may import)
- Orchestrators (use-cases)
- Ports (contracts)
- Adapters (infrastructure implementations)
- Runtime integration (entry points + DI)
- Tests (what is unit-tested and how)
- Extension points and pitfalls

