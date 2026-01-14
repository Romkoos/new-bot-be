import { buildContainer } from "../di/container";
import { readIngestionConfig } from "../../modules/news-ingestion/public";
import { shouldRunCronJobOnProcessStart } from "./pm2RunGate";

/**
 * Cron entry-point for the news ingestion use-case.
 *
 * Responsibilities:
 * - Build the DI container once.
 * - Read schedule from configuration.
 * - Schedule a job that calls only the orchestrator.
 *
 * Forbidden:
 * - Scraping / hashing / filtering / persistence logic (owned by the orchestrator).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
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
    }
  }

  // Run once. PM2 is the single source of truth for the schedule.
  container.logger.info("Cron scheduler started (news ingestion).", { schedule });
  if (shouldRunCronJobOnProcessStart(process.env)) {
    await runJob();
  }

  // Keep the process alive so PM2 can restart it on schedule.
  await new Promise(() => {
    // Intentionally empty.
  });
}

void main();
