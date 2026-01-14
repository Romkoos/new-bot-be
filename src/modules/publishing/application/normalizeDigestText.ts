/**
 * Performs minimal, deterministic normalization of generated digest text.
 *
 * Intentional constraints:
 * - No “smart” rewriting or content changes.
 * - Keep behavior stable to avoid surprising diffs and simplify debugging.
 */
export function normalizeDigestText(raw: string): string {
  // Normalize line endings to LF and trim surrounding whitespace.
  const lf = raw.replace(/\r\n?/g, "\n").trim();

  // Collapse excessive trailing whitespace per-line (stable formatting).
  return lf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

