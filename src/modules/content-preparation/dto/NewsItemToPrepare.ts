/**
 * Minimal news item shape used by the content preparation use-case.
 *
 * This is intentionally a read-model for the preparation flow (not a DB row type).
 */
export interface NewsItemToPrepare {
  readonly id: number;
  readonly source: string;
  readonly hash: string;
  readonly rawText: string;
  readonly publishedAt: string | null;
  readonly mediaType: "video" | "image" | null;
  readonly mediaUrl: string | null;
}

