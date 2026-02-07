import { describe, expect, it, vi } from "vitest";
import { NewsIngestOrch } from "../application/NewsIngestOrch";
import type { ScrapedNewsItem } from "../dto/ScrapedNewsItem";
import type { NewsScraperPort } from "../ports/NewsScraperPort";
import type { NewsItemHasherPort, NewsItemHashInput } from "../ports/NewsItemHasherPort";
import type { InsertManyResult, NewNewsItemToStore, NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";
import type { Logger } from "../../../shared/observability/logger";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

function createTestLogger(): Logger & {
  readonly info: ReturnType<typeof vi.fn>;
  readonly warn: ReturnType<typeof vi.fn>;
  readonly error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("NewsIngestOrch", () => {
  it("normalizes input before hashing (trim + collapse whitespace + publishedAt ISO-or-null)", async () => {
    const scraped: ScrapedNewsItem[] = [
      { text: "  Hello   world \n", publishedAt: "2026-01-10T10:11:00.000Z" },
      { text: "\t", publishedAt: "invalid" }, // should be dropped due to empty normalized text
      { text: "  Another\titem ", publishedAt: null },
    ];

    const scraper: NewsScraperPort = {
      source: "test-source",
      scrapeFirstFive: vi.fn(async () => scraped),
    };

    const seenHashInputs: NewsItemHashInput[] = [];
    const hasher: NewsItemHasherPort = {
      hashNormalized: vi.fn((input) => {
        seenHashInputs.push(input);
        return `hash:${input.rawText}:${input.publishedAt ?? "null"}`;
      }),
    };

    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async () => new Set<string>()),
      insertMany: vi.fn(async (_items: ReadonlyArray<NewNewsItemToStore>) => ({ insertedCount: 0 } satisfies InsertManyResult)),
      findByIds: vi.fn(async () => []),
    };

    const logger = createTestLogger();
    const timestampFormatter: UtcIsoTimestampFormatterPort = {
      nowUtcIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
      formatUtcIso: vi.fn((d: Date) => d.toISOString()),
    };

    const orchestrator = new NewsIngestOrch({ scraper, hasher, repository, logger, timestampFormatter });
    await orchestrator.run({ dryRun: true });

    expect(seenHashInputs).toEqual([
      { source: "test-source", rawText: "Hello world", publishedAt: "2026-01-10T10:11:00.000Z" },
      { source: "test-source", rawText: "Another item", publishedAt: null },
    ]);
  });

  it("filters out existing hashes and early-exits when there are no new items", async () => {
    const scraped: ScrapedNewsItem[] = [
      { text: "A", publishedAt: null },
      { text: "B", publishedAt: null },
    ];

    const scraper: NewsScraperPort = {
      source: "test-source",
      scrapeFirstFive: vi.fn(async () => scraped),
    };

    const hasher: NewsItemHasherPort = {
      hashNormalized: vi.fn((input) => `h:${input.rawText}`),
    };

    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async (hashes: ReadonlyArray<string>) => new Set<string>(hashes)), // everything exists
      insertMany: vi.fn(async (_items) => ({ insertedCount: 0 })),
      findByIds: vi.fn(async () => []),
    };

    const logger = createTestLogger();
    const timestampFormatter: UtcIsoTimestampFormatterPort = {
      nowUtcIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
      formatUtcIso: vi.fn((d: Date) => d.toISOString()),
    };

    const orchestrator = new NewsIngestOrch({ scraper, hasher, repository, logger, timestampFormatter });
    const result = await orchestrator.run({ dryRun: false });

    expect(result.scrapedCount).toBe(2);
    expect(result.newItemsCount).toBe(0);
    expect(result.storedCount).toBe(0);
    expect(result.source).toBe("test-source");

    expect(repository.insertMany).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "ingestion:news:early-exit:no-new-items",
      expect.objectContaining({ source: "test-source", durationMs: expect.any(Number) }),
    );
  });

  it("does not write to persistence in dry-run mode, but still reports correct counts", async () => {
    const scraped: ScrapedNewsItem[] = [
      { text: "X", publishedAt: null },
      { text: "Y", publishedAt: null },
    ];

    const scraper: NewsScraperPort = {
      source: "test-source",
      scrapeFirstFive: vi.fn(async () => scraped),
    };

    const hasher: NewsItemHasherPort = {
      hashNormalized: vi.fn((input) => `h:${input.rawText}`),
    };

    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async () => new Set<string>(["h:X"])), // only Y is new
      insertMany: vi.fn(async (_items) => ({ insertedCount: 123 })),
      findByIds: vi.fn(async () => []),
    };

    const logger = createTestLogger();
    const timestampFormatter: UtcIsoTimestampFormatterPort = {
      nowUtcIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
      formatUtcIso: vi.fn((d: Date) => d.toISOString()),
    };

    const orchestrator = new NewsIngestOrch({ scraper, hasher, repository, logger, timestampFormatter });
    const result = await orchestrator.run({ dryRun: true });

    expect(result.newItemsCount).toBe(1);
    expect(result.storedCount).toBe(0);
    expect(result.source).toBe("test-source");
    expect(repository.insertMany).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      "ingestion:news:done",
      expect.objectContaining({
        source: "test-source",
        dryRun: true,
        scrapedCount: 2,
        newItemsCount: 1,
        storedCount: 0,
        durationMs: expect.any(Number),
      }),
    );
  });
});

