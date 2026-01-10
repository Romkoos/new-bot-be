/**
 * Hashing port for stable, deterministic news item hashing.
 *
 * Constraints:
 * - Hashing must not happen in the scraper.
 * - The ingestion orchestrator coordinates hashing, but does not own the algorithm.
 * - Hash must be computed from the normalized representation.
 */
export interface NewsItemHasherPort {
  /**
   * Returns a stable hash for the given normalized fields.
   *
   * Implementations should treat the input as canonical (already normalized by the use-case).
   */
  hashNormalized(input: NewsItemHashInput): string;
}

/**
 * Canonical input for hashing a news item.
 *
 * The use-case is responsible for ensuring:
 * - strings are trimmed
 * - whitespace is collapsed
 * - `publishedAt` is an ISO string or `null`
 */
export interface NewsItemHashInput {
  readonly source: "mako-channel12";
  readonly rawText: string;
  readonly publishedAt: string | null;
}

