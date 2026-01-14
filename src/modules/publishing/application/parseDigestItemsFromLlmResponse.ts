/**
 * Parses digest items from an LLM response into a clean `string[]`.
 *
 * Supported *strict* input forms (deterministic):
 * 1) A JSON array of strings: `["item 1", "item 2"]`
 * 2) The same JSON array wrapped in a Markdown code fence:
 *    ```json
 *    ["item 1", "item 2"]
 *    ```
 * 3) A Markdown bullet list where every non-empty line is a bullet:
 *    - item 1
 *    - item 2
 *
 * Normalization rules:
 * - Trim items.
 * - Drop empty items.
 * - Throw if no items remain.
 */
export function parseDigestItemsFromLlmResponse(raw: string): ReadonlyArray<string> {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("LLM output must not be empty.");

  // 1) Try JSON directly.
  const jsonDirect = tryParseJsonStringArray(trimmed);
  if (jsonDirect !== null) return jsonDirect;

  // 2) Try code-fenced JSON.
  const unfenced = stripSingleMarkdownCodeFence(trimmed);
  if (unfenced !== null) {
    const jsonUnfenced = tryParseJsonStringArray(unfenced);
    if (jsonUnfenced !== null) return jsonUnfenced;
  }

  // 3) Try strict Markdown bullet list (all non-empty lines must match bullet pattern).
  const bullets = tryParseStrictBullets(trimmed);
  if (bullets) return bullets;

  throw new Error("LLM output must be a JSON array of strings (optionally in a ```json fence) or a strict bullet list.");
}

function tryParseJsonStringArray(source: string): ReadonlyArray<string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const items: string[] = [];
  for (const v of parsed) {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t.length === 0) continue;
    items.push(t);
  }

  // Empty array is valid and intentional (LLM may decide nothing is worth publishing).
  return items;
}

function stripSingleMarkdownCodeFence(source: string): string | null {
  // Accept:
  // ```json
  // <content>
  // ```
  const m = source.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/);
  if (!m) return null;
  return (m[1] ?? "").trim();
}

function tryParseStrictBullets(source: string): ReadonlyArray<string> | null {
  const lines = source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (nonEmpty.length === 0) return null;

  const items: string[] = [];
  for (const line of nonEmpty) {
    const m = line.match(/^[-*•]\s+(.+)$/);
    if (!m) return null;
    const t = (m[1] ?? "").trim();
    if (t.length === 0) continue;
    items.push(t);
  }

  if (items.length === 0) return null;
  return items;
}

