import type { DigestDto } from "../dto/DigestDto";

/**
 * Read-only port for querying existing digests.
 *
 * This is intentionally separate from `DigestRepositoryPort` to keep write concerns
 * (persist/mark published) distinct from read concerns (API listing).
 */
export interface DigestReadPort {
  /**
   * Returns digests as stored in persistence, excluding sensitive/internal columns.
   */
  listDigests(): Promise<ReadonlyArray<DigestDto>>;
}

