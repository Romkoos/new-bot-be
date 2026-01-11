import { GetHealthStatusOrchestrator, createSystemTimePort } from "../../modules/health/public";
import { NewsIngestOrch, readIngestionConfig } from "../../modules/news-ingestion/public";
import { PwMakoScraper } from "../../modules/news-ingestion/adapters/PwMakoScraper";
import { Sha256Hasher } from "../../modules/news-ingestion/adapters/Sha256Hasher";
import { SqliteNewsRepo } from "../../modules/news-ingestion/adapters/SqliteNewsRepo";
import { PrepareContentOrchestrator } from "../../modules/content-preparation/public";
import { DefaultContentProcessor } from "../../modules/content-preparation/adapters/DefaultContentProcessor";
import { SqliteContentPreparationRepo } from "../../modules/content-preparation/adapters/SqliteContentPreparationRepo";
import { createConsoleLogger } from "../../shared/observability/logger";

/**
 * Application DI container.
 *
 * Composition root rules:
 * - Object creation happens here.
 * - Entry-points (`src/app/api`, `src/app/cron`) must not instantiate adapters/orchestrators.
 */
export interface AppContainer {
  readonly logger: ReturnType<typeof createConsoleLogger>;
  readonly health: {
    readonly getHealthStatusOrchestrator: GetHealthStatusOrchestrator;
  };
  readonly ingest: {
    readonly news: NewsIngestOrch;
  };
  readonly contentPreparation: {
    readonly prepare: PrepareContentOrchestrator;
  };
}

/**
 * Builds the dependency graph for the application.
 *
 * NOTE: Keep this explicit (no magic DI frameworks) to make boundaries obvious.
 */
export function buildContainer(): AppContainer {
  const logger = createConsoleLogger();

  // Health module wiring
  const timePort = createSystemTimePort();
  const getHealthStatusOrchestrator = new GetHealthStatusOrchestrator(timePort);

  // News ingestion module wiring
  // NOTE: Public APIs export only contracts (orchestrators/DTOs/port types). Adapters are instantiated here (composition root).
  const sqlitePath = process.env.NEWS_BOT_SQLITE_PATH ?? "./data/news-bot.sqlite";
  const ingestCfg = readIngestionConfig(process.env);

  const scraper = new PwMakoScraper({
    ...ingestCfg.scraper,
  });
  const hasher = new Sha256Hasher();
  const newsRepository = new SqliteNewsRepo({ sqlitePath });
  const news = new NewsIngestOrch({
    scraper,
    hasher,
    repository: newsRepository,
    logger,
  });

  // Content preparation module wiring
  const contentPreparationRepository = new SqliteContentPreparationRepo({ sqlitePath });
  const contentProcessor = new DefaultContentProcessor();
  const prepare = new PrepareContentOrchestrator({
    repository: contentPreparationRepository,
    processor: contentProcessor,
    logger,
  });

  return {
    logger,
    health: {
      getHealthStatusOrchestrator,
    },
    ingest: {
      news,
    },
    contentPreparation: {
      prepare,
    },
  };
}
