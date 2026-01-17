import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

/**
 * Creates the `/llm-config` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only call orchestrators.
 */
export function llmConfigRoute(container: AppContainer): Router {
  const router = createRouter();

  router.get("/llm-config", async (_req, res) => {
    try {
      const result = await container.publishing.getLlmConfig.run();
      if (!result.ok) {
        res.status(500).json({ error: result.error });
        return;
      }
      res.json(result.config);
    } catch (error) {
      res.status(500).json({ error: "Failed to load llm-config.", details: String(error) });
    }
  });

  router.put("/llm-config", async (req, res) => {
    const parsed = parseUpsertBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const result = await container.publishing.upsertLlmConfig.run({
      model: parsed.model,
      instructions: parsed.instructions,
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result.config);
  });

  return router;
}

function parseUpsertBody(
  body: unknown,
): { readonly ok: true; readonly model: string; readonly instructions: string } | { readonly ok: false; readonly error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };

  const model = (body as { readonly model?: unknown }).model;
  const instructions = (body as { readonly instructions?: unknown }).instructions;

  if (typeof model !== "string" || !model.trim()) return { ok: false, error: "model must be a non-empty string." };
  if (typeof instructions !== "string" || !instructions.trim()) return { ok: false, error: "instructions must be a non-empty string." };

  return { ok: true, model: model.trim(), instructions };
}

