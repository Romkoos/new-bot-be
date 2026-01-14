import { GetNewsItemsByIdsOrchestrator, NewsIngestOrch, readIngestionConfig } from "../../modules/news-ingestion/public";
import { PwMakoScraper } from "../../modules/news-ingestion/adapters/PwMakoScraper";
import { PublishedAtResolver } from "../../modules/news-ingestion/adapters/PublishedAtResolver";
import { Sha256Hasher } from "../../modules/news-ingestion/adapters/Sha256Hasher";
import { SqliteNewsRepo } from "../../modules/news-ingestion/adapters/SqliteNewsRepo";
import { ListDigestsOrchestrator, PublishDigestOrchestrator } from "../../modules/publishing/public";
import { GoogleGeminiTextGenerator } from "../../modules/publishing/adapters/GoogleGeminiTextGenerator";
import { SqlitePublishingRepo } from "../../modules/publishing/adapters/SqlitePublishingRepo";
import { TelegramMarkdownV2DigestPostAssembler } from "../../modules/publishing/adapters/TelegramMarkdownV2DigestPostAssembler";
import { TelegramMarkdownPublisher } from "../../modules/publishing/adapters/TelegramMarkdownPublisher";
import { SystemUtcIsoTimestampFormatter } from "../../shared/adapters/SystemUtcIsoTimestampFormatter";
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
  readonly ingest: {
    readonly news: NewsIngestOrch;
    readonly getNewsItemsByIds: GetNewsItemsByIdsOrchestrator;
  };
  readonly publishing: {
    readonly publishDigest: PublishDigestOrchestrator;
    readonly listDigests: ListDigestsOrchestrator;
  };
}

/**
 * Builds the dependency graph for the application.
 *
 * NOTE: Keep this explicit (no magic DI frameworks) to make boundaries obvious.
 */
export function buildContainer(): AppContainer {
  const logger = createConsoleLogger();
  const timestampFormatter = new SystemUtcIsoTimestampFormatter();

  // News ingestion module wiring
  // NOTE: Public APIs export only contracts (orchestrators/DTOs/port types). Adapters are instantiated here (composition root).
  const sqlitePath = process.env.NEWS_BOT_SQLITE_PATH ?? "./data/news-bot.sqlite";
  const ingestCfg = readIngestionConfig(process.env);

  const publishedAtResolver = new PublishedAtResolver({
    ...(ingestCfg.scraper.timezoneId ? { timezoneId: ingestCfg.scraper.timezoneId } : {}),
    timestampFormatter,
  });

  const scraper = new PwMakoScraper({
    ...ingestCfg.scraper,
    publishedAtResolver,
    logger,
  });
  const hasher = new Sha256Hasher();
  const newsRepository = new SqliteNewsRepo({ sqlitePath, timestampFormatter });
  const news = new NewsIngestOrch({
    scraper,
    hasher,
    repository: newsRepository,
    logger,
    timestampFormatter,
  });
  const getNewsItemsByIds = new GetNewsItemsByIdsOrchestrator(newsRepository);

  // Publishing module wiring
  const publishingRepo = new SqlitePublishingRepo({ sqlitePath, timestampFormatter });
  const textGenerator = new GoogleGeminiTextGenerator({ env: process.env });
  const postAssembler = new TelegramMarkdownV2DigestPostAssembler();
  const publisher = new TelegramMarkdownPublisher({ env: process.env });
  const publishDigest = new PublishDigestOrchestrator({
    newsSelection: publishingRepo,
    digestRepository: publishingRepo,
    textGenerator,
    postAssembler,
    publisher,
    logger,
  });
  const listDigests = new ListDigestsOrchestrator(publishingRepo);

  return {
    logger,
    ingest: {
      news,
      getNewsItemsByIds,
    },
    publishing: {
      publishDigest,
      listDigests,
    },
  };
}
