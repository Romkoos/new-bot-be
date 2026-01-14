/**
 * Port for persisting generated digests and tracking publish status.
 *
 * Provider-agnostic:
 * - adapters may store to SQL, NoSQL, filesystem, etc.
 */
export interface DigestRepositoryPort {
  /**
   * Persists a newly generated digest as "not published" (pending).
   *
   * @param input.digestText - The digest body to persist (Markdown).
   * @param input.sourceItemIds - Source `news_items.id` values included in the digest (traceability).
   * @param input.sourceNewsTexts - The exact news texts used as input for the digest (prompt-level traceability).
   * @returns The created digest id.
   */
  createPendingDigest(input: {
    readonly digestText: string;
    readonly sourceItemIds: ReadonlyArray<number>;
    readonly sourceNewsTexts: ReadonlyArray<string>;
    readonly llmModel?: string;
  }): Promise<{ readonly digestId: number }>;

  /**
   * Marks the digest as published.
   *
   * @param input.digestId - Digest identifier to update.
   * @param input.finalDigestText - The final text that was actually published.
   * @param input.publisherExternalId - Optional provider-specific id (message id, post id, etc.).
   */
  markDigestPublished(input: {
    readonly digestId: number;
    readonly finalDigestText: string;
    readonly publisherExternalId?: string;
  }): Promise<void>;
}

