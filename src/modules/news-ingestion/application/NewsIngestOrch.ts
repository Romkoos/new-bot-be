import type { Logger } from "../../../shared/observability/logger";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";
import type { NewsIngestResult } from "../dto/NewsIngestResult";
import type { NewsScraperPort } from "../ports/NewsScraperPort";
import type { NewsItemHasherPort } from "../ports/NewsItemHasherPort";
import type { NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";
import type { NewsItemHashInput } from "../ports/NewsItemHasherPort";
import type { NewNewsItemToStore } from "../ports/NewsItemsRepositoryPort";

export interface NewsIngestDeps {
  readonly scraper: NewsScraperPort;
  readonly hasher: NewsItemHasherPort;
  readonly repository: NewsItemsRepositoryPort;
  readonly logger: Logger;
  readonly timestampFormatter: UtcIsoTimestampFormatterPort;
}

export interface NewsIngestOpts {
  /**
   * When enabled, the use-case performs scraping + hashing + filtering, but does not write to storage.
   */
  readonly dryRun: boolean;
}

/**
 * Ingests the latest news items from a concrete source via a scraper adapter.
 *
 * This is the single use-case that owns the entire flow:
 * scrape → hash → filter → store
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only this orchestrator and must not embed the flow.
 */
export class NewsIngestOrch {
  private readonly scraper: NewsScraperPort;
  private readonly hasher: NewsItemHasherPort;
  private readonly repository: NewsItemsRepositoryPort;
  private readonly logger: Logger;
  private readonly timestampFormatter: UtcIsoTimestampFormatterPort;

  public constructor(deps: NewsIngestDeps) {
    this.scraper = deps.scraper;
    this.hasher = deps.hasher;
    this.repository = deps.repository;
    this.logger = deps.logger;
    this.timestampFormatter = deps.timestampFormatter;
  }

  /**
   * Executes one ingestion run.
   *
   * Observability requirement: implementations must log start, counts, early-exit, and total time.
   */
  public async run(options: NewsIngestOpts): Promise<NewsIngestResult> {
    const startedAt = Date.now();
    this.logger.info("ingestion:news:start", { dryRun: options.dryRun });

    const scraped = await this.scraper.scrapeFirstFive();
    this.logger.info("ingestion:news:scraped", { count: scraped.length });

    const source = this.scraper.source;

    // Hash stability rule:
    // - Normalize minimally before hashing (trim + collapse whitespace + publishedAt ISO-or-null).
    const normalizedForHash: NewsItemHashInput[] = scraped
      .map((item) => ({
        source,
        rawText: normalizeRawText(item.text),
        publishedAt: normalizePublishedAtIsoOrNull(item.publishedAt, this.timestampFormatter),
      }))
      .filter((n) => n.rawText.length > 0);

    // Hashing is delegated to the hasher port (the orchestrator does not own the algorithm).
    const hashed = normalizedForHash.map((n) => ({
      normalized: n,
      hash: this.hasher.hashNormalized(n),
    }));

    // Filter out items already stored (by hash).
    const existing = await this.repository.findExistingHashes(hashed.map((h) => h.hash));
    const newItems = hashed.filter((h) => !existing.has(h.hash));
    const filteredOutCount = hashed.length - newItems.length;

    this.logger.info("ingestion:news:filtered", {
      source,
      existingCount: existing.size,
      filteredOutCount,
      newItemsCount: newItems.length,
    });

    if (newItems.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("ingestion:news:early-exit:no-new-items", { source, durationMs });
      return {
        source,
        dryRun: options.dryRun,
        scrapedCount: scraped.length,
        newItemsCount: 0,
        storedCount: 0,
        durationMs,
      };
    }

    const toStore: NewNewsItemToStore[] = newItems.map((item) => {
      const payload = {
        source: item.normalized.source,
        hash: item.hash,
        rawText: item.normalized.rawText,
        publishedAt: item.normalized.publishedAt,
      };

      return {
        source: item.normalized.source,
        hash: item.hash,
        rawText: item.normalized.rawText,
        publishedAt: item.normalized.publishedAt,
        payloadJson: JSON.stringify(payload),
      };
    });

    let storedCount = 0;

    if (options.dryRun) {
      // Key point: we deliberately skip persistence in dry-run mode.
    } else {
      const result = await this.repository.insertMany(toStore);
      storedCount = result.insertedCount;
    }

    const durationMs = Date.now() - startedAt;
    this.logger.info("ingestion:news:done", {
      source,
      dryRun: options.dryRun,
      scrapedCount: scraped.length,
      newItemsCount: toStore.length,
      storedCount,
      durationMs,
    });

    return {
      source,
      dryRun: options.dryRun,
      scrapedCount: scraped.length,
      newItemsCount: toStore.length,
      storedCount,
      durationMs,
    };
  }
}

function normalizeRawText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePublishedAtIsoOrNull(value: string | null, timestampFormatter: UtcIsoTimestampFormatterPort): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return timestampFormatter.formatUtcIso(parsed);
}

