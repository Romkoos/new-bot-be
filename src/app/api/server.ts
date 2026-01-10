import express from "express";
import { buildContainer } from "../di/container";
import { healthRoute } from "./routes/healthRoute";

/**
 * API entry-point.
 *
 * Responsibilities:
 * - Start the HTTP server.
 * - Wire routes to orchestrators via the DI container.
 *
 * Forbidden:
 * - Business logic.
 * - Creating adapters/orchestrators here (done in DI container).
 */
async function main(): Promise<void> {
  const container = buildContainer();

  const app = express();
  app.use(express.json());

  app.use(healthRoute(container));

  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    container.logger.info(`API listening on port ${port}`);
  });
}

void main();

