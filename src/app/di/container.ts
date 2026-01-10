import { GetHealthStatusOrchestrator, createSystemTimePort } from "../../modules/health/public";
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

  return {
    logger,
    health: {
      getHealthStatusOrchestrator,
    },
  };
}

