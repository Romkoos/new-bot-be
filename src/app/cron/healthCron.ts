import cron from "node-cron";
import { buildContainer } from "../di/container";

/**
 * Cron entry-point.
 *
 * Responsibilities:
 * - Build the DI container once.
 * - Schedule jobs.
 *
 * Forbidden:
 * - Business logic (jobs must only call orchestrators).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  const container = buildContainer();

  // Every minute.
  cron.schedule("* * * * *", () => {
    const result = container.health.getHealthStatusOrchestrator.run();
    container.logger.info("cron:health", result);
  });

  container.logger.info("Cron scheduler started (health runs every minute).");
}

void main();

