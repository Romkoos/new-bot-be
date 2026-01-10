import { createHash } from "node:crypto";
import type { NewsItemHasherPort, NewsItemHashInput } from "../ports/NewsItemHasherPort";

/**
 * SHA-256 based stable hasher for normalized news items.
 *
 * Constraints:
 * - Input must already be canonical/normalized by the use-case.
 * - This class implements the hashing algorithm so the orchestrator does not own it.
 */
export class Sha256Hasher implements NewsItemHasherPort {
  public hashNormalized(input: NewsItemHashInput): string {
    const canonical = canonicalizeHashInput(input);
    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }
}

function canonicalizeHashInput(input: NewsItemHashInput): string {
  // Use a stable key order for deterministic stringification.
  return JSON.stringify({
    source: input.source,
    rawText: input.rawText,
    publishedAt: input.publishedAt,
  });
}

