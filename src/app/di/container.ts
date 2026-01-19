import { GetHealthStatusOrchestrator, createSystemTimePort } from "../../modules/health/public";
import { GetNewsItemsByIdsOrchestrator, NewsIngestOrch, readIngestionConfig } from "../../modules/news-ingestion/public";
import { PwMakoScraper } from "../../modules/news-ingestion/adapters/PwMakoScraper";
import { PublishedAtResolver } from "../../modules/news-ingestion/adapters/PublishedAtResolver";
import { Sha256Hasher } from "../../modules/news-ingestion/adapters/Sha256Hasher";
import { SqliteNewsRepo } from "../../modules/news-ingestion/adapters/SqliteNewsRepo";
import {
  CreateLlmModelOrchestrator,
  CreateLlmOrchestrator,
  DeleteLlmModelOrchestrator,
  DeleteLlmOrchestrator,
  GetLlmConfigOrchestrator,
  ListLlmsOrchestrator,
  ListModelsByLlmIdOrchestrator,
  ListDigestsOrchestrator,
  PublishDigestOrchestrator,
  UpdateLlmModelOrchestrator,
  UpdateLlmOrchestrator,
  UpsertLlmConfigOrchestrator,
} from "../../modules/publishing/public";
import { GoogleGeminiTextGenerator } from "../../modules/publishing/adapters/GoogleGeminiTextGenerator";
import { SqlitePublishingRepo } from "../../modules/publishing/adapters/SqlitePublishingRepo";
import { TelegramMarkdownV2DigestPostAssembler } from "../../modules/publishing/adapters/TelegramMarkdownV2DigestPostAssembler";
import { TelegramMarkdownPublisher } from "../../modules/publishing/adapters/TelegramMarkdownPublisher";
import { LlmCatalogService } from "../../modules/publishing/application/LlmCatalogService";
import { LlmConfigService } from "../../modules/publishing/application/LlmConfigService";
import { SystemUtcIsoTimestampFormatter } from "../../shared/adapters/SystemUtcIsoTimestampFormatter";
import { createConsoleLogger } from "../../shared/observability/logger";
import { BootSequenceOrchestrator } from "../../modules/news-pipeline/public";

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
    readonly getNewsItemsByIds: GetNewsItemsByIdsOrchestrator;
  };
  readonly publishing: {
    readonly publishDigest: PublishDigestOrchestrator;
    readonly listDigests: ListDigestsOrchestrator;
    readonly getLlmConfig: GetLlmConfigOrchestrator;
    readonly upsertLlmConfig: UpsertLlmConfigOrchestrator;
    readonly listLlms: ListLlmsOrchestrator;
    readonly listModelsByLlmId: ListModelsByLlmIdOrchestrator;
    readonly createLlm: CreateLlmOrchestrator;
    readonly updateLlm: UpdateLlmOrchestrator;
    readonly deleteLlm: DeleteLlmOrchestrator;
    readonly createModel: CreateLlmModelOrchestrator;
    readonly updateModel: UpdateLlmModelOrchestrator;
    readonly deleteModel: DeleteLlmModelOrchestrator;
  };
  readonly newsPipeline: {
    readonly bootSequence: BootSequenceOrchestrator;
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

  // Health module wiring
  const timePort = createSystemTimePort(timestampFormatter);
  const getHealthStatusOrchestrator = new GetHealthStatusOrchestrator(timePort);

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
  // Ensure the LLM catalog tables exist and are seeded on boot (idempotent).
  const llmCatalogService = new LlmCatalogService({ sqlitePath });
  const llmConfigService = new LlmConfigService({ sqlitePath, timestampFormatter });
  const textGenerator = new GoogleGeminiTextGenerator({ env: process.env });
  const postAssembler = new TelegramMarkdownV2DigestPostAssembler();
  const publisher = new TelegramMarkdownPublisher({ env: process.env });
  const publishDigest = new PublishDigestOrchestrator({
    newsSelection: publishingRepo,
    digestRepository: publishingRepo,
    textGenerator,
    llmConfigService,
    postAssembler,
    publisher,
    logger,
  });
  const listDigests = new ListDigestsOrchestrator(publishingRepo);
  const getLlmConfig = new GetLlmConfigOrchestrator(llmConfigService);
  const upsertLlmConfig = new UpsertLlmConfigOrchestrator(llmConfigService);
  const listLlms = new ListLlmsOrchestrator(llmCatalogService);
  const listModelsByLlmId = new ListModelsByLlmIdOrchestrator(llmCatalogService);
  const createLlm = new CreateLlmOrchestrator(llmCatalogService);
  const updateLlm = new UpdateLlmOrchestrator(llmCatalogService);
  const deleteLlm = new DeleteLlmOrchestrator(llmCatalogService);
  const createModel = new CreateLlmModelOrchestrator(llmCatalogService);
  const updateModel = new UpdateLlmModelOrchestrator(llmCatalogService);
  const deleteModel = new DeleteLlmModelOrchestrator(llmCatalogService);

  // News pipeline module wiring
  const bootSequence = new BootSequenceOrchestrator({
    health: getHealthStatusOrchestrator,
    ingest: news,
    publishDigest,
  });

  return {
    logger,
    health: {
      getHealthStatusOrchestrator,
    },
    ingest: {
      news,
      getNewsItemsByIds,
    },
    publishing: {
      publishDigest,
      listDigests,
      getLlmConfig,
      upsertLlmConfig,
      listLlms,
      listModelsByLlmId,
      createLlm,
      updateLlm,
      deleteLlm,
      createModel,
      updateModel,
      deleteModel,
    },
    newsPipeline: {
      bootSequence,
    },
  };
}
