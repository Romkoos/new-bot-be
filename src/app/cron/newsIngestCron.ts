import { buildContainer } from "../di/container";
import { readIngestionConfig } from "../../modules/news-ingestion/public";
import { loadEnvFiles } from "../config/loadEnv";

/**
 * Cron entry-point for the news ingestion use-case.
 *
 * Responsibilities:
 * - Load `.env` / `.env.local` (if present).
 * - Build the DI container once.
 * - Read schedule from configuration.
 * - Run the job once per invocation (manual execution).
 *
 * Forbidden:
 * - Scraping / hashing / filtering / persistence logic (owned by the orchestrator).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  const container = buildContainer();

  const schedule = readIngestionConfig(process.env).cronSchedule;

  async function runJob(): Promise<void> {
    const startedAt = Date.now();
    container.logger.info("cron:news:ingestion:start", { schedule });

    try {
      const result = await container.ingest.news.run({ dryRun: false });
      const durationMs = Date.now() - startedAt;

      container.logger.info("cron:news:ingestion:done", {
        durationMs,
        source: result.source,
        dryRun: result.dryRun,
        scrapedCount: result.scrapedCount,
        newItemsCount: result.newItemsCount,
        storedCount: result.storedCount,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      container.logger.error("cron:news:ingestion:error", { durationMs, error });
      process.exit(1);
    }
  }

  container.logger.info("cron:news:ingestion:run", { schedule });
  await runJob();
  process.exit(0);
}

void main();
