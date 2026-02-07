import express from "express";
import { buildContainer } from "../di/container";
import { digestsRoute } from "./routes/digestsRoute";
import { filtersRoute } from "./routes/filtersRoute";
import { llmConfigRoute } from "./routes/llmConfigRoute";
import { llmModelsRoute } from "./routes/llmModelsRoute";
import { llmsRoute } from "./routes/llmsRoute";
import { newsItemsRoute } from "./routes/newsItemsRoute";

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

  // All REST endpoints must be served under the `/api` prefix.
  app.use("/api", digestsRoute(container));
  app.use("/api", newsItemsRoute(container));
  app.use("/api", filtersRoute(container));
  app.use("/api", llmConfigRoute(container));
  app.use("/api", llmsRoute(container));
  app.use("/api", llmModelsRoute(container));

  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    container.logger.info(`API listening on port ${port}`);
  });
}

void main();

