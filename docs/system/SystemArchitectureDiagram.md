# System architecture diagrams

## Purpose
These diagrams explain the runtime shape of the backend at three levels:

- Big picture: boundaries and ownership (entry points, DI, orchestrators, adapters).
- API request: how a browser request becomes a use case execution.
- Boot sequence: how PM2 triggers deterministic startup ordering.

## Diagram 1: Big picture

```mermaid
flowchart LR
  subgraph EntryPoints[Entry points]
    API[API]
    CRON[Cron]
    CLI[CLI]
  end

  DI[DI container]

  subgraph Orchestrators[Orchestrators]
    HealthOrch[Health orchestrator]
    IngestOrch[News ingestion orchestrator]
    PublishOrch[Publishing orchestrator]
    BootOrch[Boot sequence orchestrator]
  end

  subgraph Adapters[Adapters and externals]
    Time[System time]
    Sqlite[SQLite]
    Scraper[Scraper]
    LLM[LLM provider]
    Telegram[Telegram]
  end

  API --> DI
  CRON --> DI
  CLI --> DI

  DI --> HealthOrch
  DI --> IngestOrch
  DI --> PublishOrch
  DI --> BootOrch

  HealthOrch --> Time
  IngestOrch --> Scraper
  IngestOrch --> Sqlite
  PublishOrch --> Sqlite
  PublishOrch --> LLM
  PublishOrch --> Telegram

  BootOrch --> HealthOrch
  BootOrch --> IngestOrch
  BootOrch --> PublishOrch
```

## Diagram 2: API request flow

```mermaid
flowchart LR
  UI[Browser UI]
  Route[API route handler]
  UseCase[Orchestrator]
  Store[SQLite]
  Gen[LLM provider]
  Pub[Telegram]
  Resp[HTTP response]

  UI --> Route
  Route --> UseCase
  UseCase --> Store
  UseCase --> Gen
  UseCase --> Pub
  UseCase --> Resp
```

## Diagram 3: PM2 boot sequence flow

```mermaid
flowchart LR
  PM2[PM2 start]
  BootEntry[Boot sequence entry point]
  BootOrch[Boot sequence orchestrator]
  Health[Health orchestrator]
  Ingest[News ingestion orchestrator]
  Publish[Publishing orchestrator]

  PM2 --> BootEntry
  BootEntry --> BootOrch
  BootOrch --> Health
  BootOrch --> Ingest
  BootOrch --> Publish
```
