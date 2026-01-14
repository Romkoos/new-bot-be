import type { Router } from "express";
import { Router as createRouter } from "express";
import type { AppContainer } from "../../di/container";

const MAX_IDS = 500;

/**
 * Creates the `/news-items` HTTP route(s).
 *
 * Entry-point rule: route handlers must not contain business logic; they only call orchestrators.
 */
export function newsItemsRoute(container: AppContainer): Router {
  const router = createRouter();

  router.get("/news-items/by-ids", async (req, res) => {
    const parsed = parseCommaSeparatedIds(req.query.ids);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const items = await container.ingest.getNewsItemsByIds.run({ ids: parsed.ids });
    res.json(items);
  });

  return router;
}

function parseCommaSeparatedIds(value: unknown): { readonly ok: true; readonly ids: ReadonlyArray<number> } | { readonly ok: false; readonly error: string } {
  // Express can give `string | string[] | undefined`.
  if (value == null) return { ok: false, error: "Missing required query param: ids" };

  // Spec (approved): `?ids=1,2,3`
  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Query param ids must not be empty." };

  const parts = trimmed.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: false, error: "Query param ids must not be empty." };
  if (parts.length > MAX_IDS) return { ok: false, error: `Too many ids; max is ${MAX_IDS}.` };

  const ids: number[] = [];
  for (const part of parts) {
    // Only accept base-10 positive integers.
    if (!/^\d+$/.test(part)) return { ok: false, error: `Invalid id: ${part}` };
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: `Invalid id: ${part}` };
    ids.push(n);
  }

  return { ok: true, ids };
}

