import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

/**
 * Creates the `/llms` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only validate inputs and call orchestrators.
 */
export function llmsRoute(container: AppContainer): Router {
  const router = createRouter();

  router.get("/llms", async (_req, res) => {
    try {
      const result = await container.publishing.listLlms.run();
      if (!result.ok) {
        res.status(500).json({ error: result.error });
        return;
      }
      res.json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to list LLMs.", details: String(error) });
    }
  });

  router.get("/llms/:id/models", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!id.ok) {
      res.status(400).json({ error: id.error });
      return;
    }

    try {
      const result = await container.publishing.listModelsByLlmId.run({ llmId: id.value });
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to list models.", details: String(error) });
    }
  });

  router.post("/llms", async (req, res) => {
    const parsed = parseCreateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const result = await container.publishing.createLlm.run(parsed.value);
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.status(201).json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to create LLM.", details: String(error) });
    }
  });

  router.put("/llms/:id", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!id.ok) {
      res.status(400).json({ error: id.error });
      return;
    }

    const parsed = parseUpdateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const result = await container.publishing.updateLlm.run({ id: id.value, ...parsed.value });
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to update LLM.", details: String(error) });
    }
  });

  router.delete("/llms/:id", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!id.ok) {
      res.status(400).json({ error: id.error });
      return;
    }

    try {
      const result = await container.publishing.deleteLlm.run({ id: id.value });
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete LLM.", details: String(error) });
    }
  });

  return router;
}

function parseIdParam(raw: unknown): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "id param is required." };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "id must be a positive integer." };
  return { ok: true, value: n };
}

function parseCreateBody(
  body: unknown,
): { readonly ok: true; readonly value: { readonly name: string; readonly alias: string } } | { readonly ok: false; readonly error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };
  const name = (body as { readonly name?: unknown }).name;
  const alias = (body as { readonly alias?: unknown }).alias;

  if (typeof name !== "string" || !name.trim()) return { ok: false, error: "name must be a non-empty string." };
  if (typeof alias !== "string" || !alias.trim()) return { ok: false, error: "alias must be a non-empty string." };

  return { ok: true, value: { name: name.trim(), alias: alias.trim() } };
}

function parseUpdateBody(
  body: unknown,
): { readonly ok: true; readonly value: { readonly name?: string; readonly alias?: string } } | { readonly ok: false; readonly error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };
  const name = (body as { readonly name?: unknown }).name;
  const alias = (body as { readonly alias?: unknown }).alias;

  const out: { name?: string; alias?: string } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: "name must be a non-empty string when provided." };
    out.name = name.trim();
  }

  if (alias !== undefined) {
    if (typeof alias !== "string" || !alias.trim()) return { ok: false, error: "alias must be a non-empty string when provided." };
    out.alias = alias.trim();
  }

  if (out.name === undefined && out.alias === undefined) {
    return { ok: false, error: "At least one of name or alias must be provided." };
  }

  return { ok: true, value: out };
}

function mapErrorToStatus(error: string): 400 | 404 {
  if (error.toLowerCase().includes("not found")) return 404;
  return 400;
}

