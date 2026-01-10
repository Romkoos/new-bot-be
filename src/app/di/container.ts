import { GetHealthStatusOrchestrator, createSystemTimePort } from "../../modules/health/public";
import { MakoIngestOrch, readMakoConfig } from "../../modules/news-ingestion/public";
import { PwMakoScraper } from "../../modules/news-ingestion/adapters/PwMakoScraper";
import { Sha256Hasher } from "../../modules/news-ingestion/adapters/Sha256Hasher";
import { SqliteNewsRepo } from "../../modules/news-ingestion/adapters/SqliteNewsRepo";
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
    readonly mako: MakoIngestOrch;
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
  const makoCfg = readMakoConfig(process.env);

  const makoScraper = new PwMakoScraper({
    ...makoCfg.scraper,
  });
  const hasher = new Sha256Hasher();
  const newsRepository = new SqliteNewsRepo({ sqlitePath });
  const mako = new MakoIngestOrch({
    scraper: makoScraper,
    hasher,
    repository: newsRepository,
    logger,
  });

  return {
    logger,
    health: {
      getHealthStatusOrchestrator,
    },
    ingest: {
      mako,
    },
  };
}
