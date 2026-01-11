import type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";

/**
 * Processing port for preparing content for publication.
 *
 * Constraints:
 * - Implementations must be pure transformation: no database access, no network calls.
 * - The processor receives all selected news items and aggregates them into a single collection (`string[]`).
 * - Each string must include metadata (the initial convention will be JSON strings).
 */
export interface ContentProcessorPort {
  process(items: ReadonlyArray<NewsItemToPrepare>): ReadonlyArray<string>;
}

