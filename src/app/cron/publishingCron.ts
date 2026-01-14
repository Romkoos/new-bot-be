import { readPublishingConfig } from "../../modules/publishing/public";
import { loadEnvFiles } from "../config/loadEnv";
import { buildContainer } from "../di/container";

/**
 * Cron entry-point for the publishing use-case.
 *
 * Responsibilities:
 * - Load `.env` / `.env.local` (if present).
 * - Build the DI container once.
 * - Read schedule from configuration.
 * - Run the job once per invocation (manual execution).
 *
 * Forbidden:
 * - Business logic (owned by the orchestrator).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  loadEnvFiles();
  const container = buildContainer();

  const schedule = readPublishingConfig(process.env).cronSchedule;

  async function runJob(): Promise<void> {
    const startedAt = Date.now();
    container.logger.info("cron:publishing:digest:start", { schedule });

    try {
      const result = await container.publishing.publishDigest.run();
      const durationMs = Date.now() - startedAt;
      container.logger.info("cron:publishing:digest:done", { ...result, durationMs, schedule });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      container.logger.error("cron:publishing:digest:error", { durationMs, schedule, error });
      process.exit(1);
    }
  }

  container.logger.info("cron:publishing:digest:run", { schedule });
  await runJob();
  process.exit(0);
}

void main();

