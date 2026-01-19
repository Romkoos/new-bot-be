import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

/**
 * Creates the `/llm-models` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only validate inputs and call orchestrators.
 */
export function llmModelsRoute(container: AppContainer): Router {
  const router = createRouter();

  router.post("/llm-models", async (req, res) => {
    const parsed = parseCreateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const result = await container.publishing.createModel.run(parsed.value);
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.status(201).json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to create model.", details: String(error) });
    }
  });

  router.put("/llm-models/:id", async (req, res) => {
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
      const result = await container.publishing.updateModel.run({ id: id.value, ...parsed.value });
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.json(result.value);
    } catch (error) {
      res.status(500).json({ error: "Failed to update model.", details: String(error) });
    }
  });

  router.delete("/llm-models/:id", async (req, res) => {
    const id = parseIdParam(req.params.id);
    if (!id.ok) {
      res.status(400).json({ error: id.error });
      return;
    }

    try {
      const result = await container.publishing.deleteModel.run({ id: id.value });
      if (!result.ok) {
        res.status(mapErrorToStatus(result.error)).json({ error: result.error });
        return;
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete model.", details: String(error) });
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
):
  | { readonly ok: true; readonly value: { readonly llmId: number; readonly name: string } }
  | { readonly ok: false; readonly error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };

  const llmId = (body as { readonly llmId?: unknown }).llmId;
  const name = (body as { readonly name?: unknown }).name;

  if (typeof llmId !== "number" || !Number.isInteger(llmId) || llmId <= 0) return { ok: false, error: "llmId must be a positive integer." };
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: "name must be a non-empty string." };

  return { ok: true, value: { llmId, name: name.trim() } };
}

function parseUpdateBody(
  body: unknown,
): { readonly ok: true; readonly value: { readonly llmId?: number; readonly name?: string } } | { readonly ok: false; readonly error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object." };
  const llmId = (body as { readonly llmId?: unknown }).llmId;
  const name = (body as { readonly name?: unknown }).name;

  const out: { llmId?: number; name?: string } = {};

  if (llmId !== undefined) {
    if (typeof llmId !== "number" || !Number.isInteger(llmId) || llmId <= 0) return { ok: false, error: "llmId must be a positive integer." };
    out.llmId = llmId;
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return { ok: false, error: "name must be a non-empty string when provided." };
    out.name = name.trim();
  }

  if (out.llmId === undefined && out.name === undefined) {
    return { ok: false, error: "At least one of llmId or name must be provided." };
  }

  return { ok: true, value: out };
}

function mapErrorToStatus(error: string): 400 | 404 {
  if (error.toLowerCase().includes("not found")) return 404;
  return 400;
}

