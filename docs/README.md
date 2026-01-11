# Docs

## Reading order

1. [Overview](./Overview.md)
2. [Architecture](./Architecture.md)
3. [Ingestion](./ingestion/README.md)

## Structure

### System
- [Lifecycle](./system/Lifecycle.md) (startup/shutdown for API/Cron/CLI)
- [Dependency Injection](./system/DependencyInjection.md) (composition root, wiring rules)

### Modules
- [Modules index](./modules/README.md)
- [`health`](./modules/health.md)
- [`news-ingestion`](./modules/news-ingestion.md)
- [`content-preparation`](./modules/content-preparation.md)

### Ingestion (topic)
- [Ingestion topic index](./ingestion/README.md)
- [Orchestration](./ingestion/Orchestration.md) (use-case flow + idempotency)
- [Entry points](./ingestion/EntryPoints.md) (Cron/CLI participation)
- [Config](./ingestion/Config.md) (INGEST_* env vars via module config)
- [Scraping](./ingestion/Scraping.md) (Playwright behavior + selectors)
- [Hashing](./ingestion/Hashing.md) (normalization + stable hashing)
- [Storage](./ingestion/Storage.md) (SQLite schema + dedup)
- [Observability](./ingestion/Observability.md) (log namespaces + semantics)
- [Failure modes](./ingestion/FailureModes.md) (timeouts/bot checks/db errors)

