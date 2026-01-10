import { describe, expect, it, vi } from "vitest";
import { MakoIngestOrch } from "../application/MakoIngestOrch";
import type { MakoScrapedItem } from "../dto/MakoScrapedItem";
import type { MakoScraperPort } from "../ports/MakoScraperPort";
import type { NewsItemHasherPort, NewsItemHashInput } from "../ports/NewsItemHasherPort";
import type { InsertManyResult, NewNewsItemToStore, NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";
import type { Logger } from "../../../shared/observability/logger";

function createTestLogger(): Logger & { readonly info: ReturnType<typeof vi.fn>; readonly error: ReturnType<typeof vi.fn> } {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("MakoIngestOrch", () => {
  it("normalizes input before hashing (trim + collapse whitespace + publishedAt ISO-or-null)", async () => {
    const scraped: MakoScrapedItem[] = [
      { text: "  Hello   world \n", publishedAt: "2026-01-10T10:11:00.000Z" },
      { text: "\t", publishedAt: "invalid" }, // should be dropped due to empty normalized text
      { text: "  Another\titem ", publishedAt: null },
    ];

    const scraper: MakoScraperPort = {
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
    };

    const logger = createTestLogger();

    const orchestrator = new MakoIngestOrch({ scraper, hasher, repository, logger });
    await orchestrator.run({ dryRun: true });

    expect(seenHashInputs).toEqual([
      { source: "mako-channel12", rawText: "Hello world", publishedAt: "2026-01-10T10:11:00.000Z" },
      { source: "mako-channel12", rawText: "Another item", publishedAt: null },
    ]);
  });

  it("filters out existing hashes and early-exits when there are no new items", async () => {
    const scraped: MakoScrapedItem[] = [
      { text: "A", publishedAt: null },
      { text: "B", publishedAt: null },
    ];

    const scraper: MakoScraperPort = {
      scrapeFirstFive: vi.fn(async () => scraped),
    };

    const hasher: NewsItemHasherPort = {
      hashNormalized: vi.fn((input) => `h:${input.rawText}`),
    };

    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async (hashes: ReadonlyArray<string>) => new Set<string>(hashes)), // everything exists
      insertMany: vi.fn(async (_items) => ({ insertedCount: 0 })),
    };

    const logger = createTestLogger();

    const orchestrator = new MakoIngestOrch({ scraper, hasher, repository, logger });
    const result = await orchestrator.run({ dryRun: false });

    expect(result.scrapedCount).toBe(2);
    expect(result.newItemsCount).toBe(0);
    expect(result.storedCount).toBe(0);

    expect(repository.insertMany).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "ingestion:mako:early-exit:no-new-items",
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it("does not write to persistence in dry-run mode, but still reports correct counts", async () => {
    const scraped: MakoScrapedItem[] = [
      { text: "X", publishedAt: null },
      { text: "Y", publishedAt: null },
    ];

    const scraper: MakoScraperPort = {
      scrapeFirstFive: vi.fn(async () => scraped),
    };

    const hasher: NewsItemHasherPort = {
      hashNormalized: vi.fn((input) => `h:${input.rawText}`),
    };

    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async () => new Set<string>(["h:X"])), // only Y is new
      insertMany: vi.fn(async (_items) => ({ insertedCount: 123 })),
    };

    const logger = createTestLogger();

    const orchestrator = new MakoIngestOrch({ scraper, hasher, repository, logger });
    const result = await orchestrator.run({ dryRun: true });

    expect(result.newItemsCount).toBe(1);
    expect(result.storedCount).toBe(0);
    expect(repository.insertMany).not.toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      "ingestion:mako:done",
      expect.objectContaining({
        dryRun: true,
        scrapedCount: 2,
        newItemsCount: 1,
        storedCount: 0,
        durationMs: expect.any(Number),
      }),
    );
  });
});

