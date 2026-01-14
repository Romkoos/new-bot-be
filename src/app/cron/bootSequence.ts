import { buildContainer } from "../di/container";
import { readIngestionConfig } from "../../modules/news-ingestion/public";
import { readPublishingConfig } from "../../modules/publishing/public";
import { loadEnvFiles } from "../config/loadEnv";

/**
 * Boot-time cron sequence entry point.
 *
 * Runs the existing cron jobs once, in strict order:
 * health → ingest → publishing
 *
 * Scheduling responsibility is owned by PM2. This script is intended to be started by PM2
 * on system/PM2 start (including VM reboot), and it exits after completing the sequence.
 *
 * Forbidden:
 * - Business logic (owned by orchestrators).
 * - In-process time scheduling.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  const container = buildContainer();

  // 1) health
  const healthResult = container.health.getHealthStatusOrchestrator.run();
  container.logger.info("cron:health", healthResult);

  // 2) ingest
  const ingestSchedule = readIngestionConfig(process.env).cronSchedule;
  const ingestStartedAt = Date.now();
  container.logger.info("cron:news:ingestion:start", { schedule: ingestSchedule });
  try {
    const result = await container.ingest.news.run({ dryRun: false });
    const durationMs = Date.now() - ingestStartedAt;
    container.logger.info("cron:news:ingestion:done", {
      durationMs,
      source: result.source,
      dryRun: result.dryRun,
      scrapedCount: result.scrapedCount,
      newItemsCount: result.newItemsCount,
      storedCount: result.storedCount,
    });
  } catch (error) {
    const durationMs = Date.now() - ingestStartedAt;
    container.logger.error("cron:news:ingestion:error", { durationMs, error });
  }

  // 3) publishing
  const publishSchedule = readPublishingConfig(process.env).cronSchedule;
  const publishStartedAt = Date.now();
  container.logger.info("cron:publishing:digest:start", { schedule: publishSchedule });
  try {
    const result = await container.publishing.publishDigest.run();
    const durationMs = Date.now() - publishStartedAt;
    container.logger.info("cron:publishing:digest:done", { ...result, durationMs, schedule: publishSchedule });
  } catch (error) {
    const durationMs = Date.now() - publishStartedAt;
    container.logger.error("cron:publishing:digest:error", { durationMs, schedule: publishSchedule, error });
  }
}

void main();

