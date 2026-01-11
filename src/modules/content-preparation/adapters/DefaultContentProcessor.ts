import type { NewsItemToPrepare } from "../dto/NewsItemToPrepare";
import type { ContentProcessorPort } from "../ports/ContentProcessorPort";

/**
 * Default content processor implementation.
 *
 * Output contract:
 * - Returns an array of strings.
 * - Each string is a JSON string containing content + metadata for one source item.
 */
export class DefaultContentProcessor implements ContentProcessorPort {
  public process(items: ReadonlyArray<NewsItemToPrepare>): ReadonlyArray<string> {
    return items.map((item) =>
      JSON.stringify({
        id: item.id,
        source: item.source,
        hash: item.hash,
        publishedAt: item.publishedAt,
        rawText: item.rawText,
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
      }),
    );
  }
}

