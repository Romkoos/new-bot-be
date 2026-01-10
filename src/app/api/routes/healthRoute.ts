import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

/**
 * Creates the `/health` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only call orchestrators.
 */
export function healthRoute(container: AppContainer): Router {
  const router = createRouter();

  router.get("/health", (_req, res) => {
    const result = container.health.getHealthStatusOrchestrator.run();
    res.json(result);
  });

  return router;
}

