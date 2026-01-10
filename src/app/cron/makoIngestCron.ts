import cron from "node-cron";
import { buildContainer } from "../di/container";
import { readMakoConfig } from "../../modules/news-ingestion/public";

/**
 * Cron entry-point for Mako Channel 12 ingestion.
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

  const schedule = readMakoConfig(process.env).cronSchedule;

  async function runJob(): Promise<void> {
    const startedAt = Date.now();
    container.logger.info("cron:mako:ingestion:start", { schedule });

    try {
      const result = await container.ingest.mako.run({ dryRun: false });
      const durationMs = Date.now() - startedAt;

      container.logger.info("cron:mako:ingestion:done", {
        durationMs,
        source: result.source,
        dryRun: result.dryRun,
        scrapedCount: result.scrapedCount,
        newItemsCount: result.newItemsCount,
        storedCount: result.storedCount,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      container.logger.error("cron:mako:ingestion:error", { durationMs, error });
    }
  }

  cron.schedule(schedule, () => {
    void runJob();
  });

  container.logger.info("Cron scheduler started (mako ingestion).", { schedule });
}

void main();

