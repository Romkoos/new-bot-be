import type { Logger } from "../../../shared/observability/logger";
import type { MakoIngestResult } from "../dto/MakoIngestResult";
import type { MakoScraperPort } from "../ports/MakoScraperPort";
import type { NewsItemHasherPort } from "../ports/NewsItemHasherPort";
import type { NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";
import type { NewsItemHashInput } from "../ports/NewsItemHasherPort";
import type { NewNewsItemToStore } from "../ports/NewsItemsRepositoryPort";

export interface MakoIngestDeps {
  readonly scraper: MakoScraperPort;
  readonly hasher: NewsItemHasherPort;
  readonly repository: NewsItemsRepositoryPort;
  readonly logger: Logger;
}

export interface MakoIngestOpts {
  /**
   * When enabled, the use-case performs scraping + hashing + filtering, but does not write to storage.
   */
  readonly dryRun: boolean;
}

/**
 * Ingests the latest Mako Channel 12 news items.
 *
 * This is the single use-case that owns the entire flow:
 * scrape → hash → filter → store
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only this orchestrator and must not embed the flow.
 */
export class MakoIngestOrch {
  private readonly scraper: MakoScraperPort;
  private readonly hasher: NewsItemHasherPort;
  private readonly repository: NewsItemsRepositoryPort;
  private readonly logger: Logger;

  public constructor(deps: MakoIngestDeps) {
    this.scraper = deps.scraper;
    this.hasher = deps.hasher;
    this.repository = deps.repository;
    this.logger = deps.logger;
  }

  /**
   * Executes one ingestion run.
   *
   * Observability requirement: implementations must log start, counts, early-exit, and total time.
   */
  public async run(options: MakoIngestOpts): Promise<MakoIngestResult> {
    const startedAt = Date.now();
    this.logger.info("ingestion:mako:start", { dryRun: options.dryRun });

    const scraped = await this.scraper.scrapeFirstFive();
    this.logger.info("ingestion:mako:scraped", { count: scraped.length });

    const SOURCE: NewsItemHashInput["source"] = "mako-channel12";

    // Hash stability rule:
    // - Normalize minimally before hashing (trim + collapse whitespace + publishedAt ISO-or-null).
    const normalizedForHash: NewsItemHashInput[] = scraped
      .map((item) => ({
        source: SOURCE,
        rawText: normalizeRawText(item.text),
        publishedAt: normalizePublishedAtIsoOrNull(item.publishedAt),
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

    this.logger.info("ingestion:mako:filtered", {
      existingCount: existing.size,
      filteredOutCount,
      newItemsCount: newItems.length,
    });

    if (newItems.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("ingestion:mako:early-exit:no-new-items", { durationMs });
      return {
        source: "mako-channel12",
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
        source: "mako-channel12",
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
    this.logger.info("ingestion:mako:done", {
      dryRun: options.dryRun,
      scrapedCount: scraped.length,
      newItemsCount: toStore.length,
      storedCount,
      durationMs,
    });

    return {
      source: "mako-channel12",
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

function normalizePublishedAtIsoOrNull(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
