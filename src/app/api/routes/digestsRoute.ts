import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

/**
 * Creates the `/digests` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only call orchestrators.
 */
export function digestsRoute(container: AppContainer): Router {
  const router = createRouter();

  router.get("/digests", async (_req, res) => {
    const digests = await container.publishing.listDigests.run();
    res.json(digests);
  });

  return router;
}

