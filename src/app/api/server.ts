import express from "express";
import { buildContainer } from "../di/container";
import { digestsRoute } from "./routes/digestsRoute";
import { healthRoute } from "./routes/healthRoute";
import { llmConfigRoute } from "./routes/llmConfigRoute";
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
  app.use("/api", healthRoute(container));
  app.use("/api", digestsRoute(container));
  app.use("/api", newsItemsRoute(container));
  app.use("/api", llmConfigRoute(container));

  // Backwards-compatibility for reverse proxies (e.g. nginx) that rewrite `/api/*` to `/*`
  // before forwarding to this server.
  app.use("/", healthRoute(container));
  app.use("/", digestsRoute(container));
  app.use("/", newsItemsRoute(container));
  app.use("/", llmConfigRoute(container));

  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, () => {
    container.logger.info(`API listening on port ${port}`);
  });
}

void main();

