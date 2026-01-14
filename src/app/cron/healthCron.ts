import { buildContainer } from "../di/container";

/**
 * Cron entry-point.
 *
 * Responsibilities:
 * - Build the DI container once.
 * - Run jobs once per process start.
 *
 * Forbidden:
 * - Business logic (jobs must only call orchestrators).
 * - Instantiating adapters/orchestrators outside DI.
 */
async function main(): Promise<void> {
  const container = buildContainer();

  // Run once. PM2 is the single source of truth for the schedule.
  function runJob(): void {
    const result = container.health.getHealthStatusOrchestrator.run();
    container.logger.info("cron:health", result);
  }

  runJob();

  // Keep the process alive so PM2 can restart it on schedule.
  await new Promise(() => {
    // Intentionally empty.
  });
}

void main();

