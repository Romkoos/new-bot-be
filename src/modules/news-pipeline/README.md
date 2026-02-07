# News pipeline module

This module owns cross-module business flows that do not clearly belong to a single existing module (e.g. boot-time sequencing).

```mermaid
flowchart LR
  BootEntry[cron_boot_sequence_entry] --> BootOrch[BootSequenceOrchestrator]
  BootOrch --> Health[health_GetHealthStatusOrchestrator]
  BootOrch --> Ingest[news_ingestion_NewsIngestOrch]
  BootOrch --> Publish[publishing_PublishDigestOrchestrator]
```

See `docs/modules/news-pipeline.md` for the deep dive.

