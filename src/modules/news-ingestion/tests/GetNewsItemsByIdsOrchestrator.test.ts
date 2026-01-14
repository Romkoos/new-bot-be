import { describe, expect, it, vi } from "vitest";
import { GetNewsItemsByIdsOrchestrator } from "../application/GetNewsItemsByIdsOrchestrator";
import type { NewsItemDto } from "../dto/NewsItemDto";
import type { InsertManyResult, NewNewsItemToStore, NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";

describe("GetNewsItemsByIdsOrchestrator", () => {
  it("preserves input order and returns null for missing ids", async () => {
    const repository: NewsItemsRepositoryPort = {
      // Unused by this orchestrator, but required by the interface.
      findExistingHashes: vi.fn(async () => new Set<string>()),
      insertMany: vi.fn(async () => ({ insertedCount: 0 } satisfies InsertManyResult)),

      // Return rows in a different order to prove orchestrator enforces order.
      findByIds: vi.fn(async (_ids) => {
        const r1: NewsItemDto = {
          id: 1,
          source: "s",
          raw_text: "a",
          published_at: null,
          scraped_at: "2026-01-01T00:00:00.000Z",
          processed: 0,
          media_type: null,
          media_url: null,
        };
        const r3: NewsItemDto = { ...r1, id: 3, raw_text: "c" };
        return [r3, r1];
      }),
    };

    const orch = new GetNewsItemsByIdsOrchestrator(repository);
    const result = await orch.run({ ids: [1, 2, 3] });

    expect(result).toEqual([
      expect.objectContaining({ id: 1 }),
      null,
      expect.objectContaining({ id: 3 }),
    ]);
    expect(repository.findByIds).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("throws when ids contain non-positive integers", async () => {
    const repository: NewsItemsRepositoryPort = {
      findExistingHashes: vi.fn(async () => new Set<string>()),
      insertMany: vi.fn(async (_items: ReadonlyArray<NewNewsItemToStore>) => ({ insertedCount: 0 } satisfies InsertManyResult)),
      findByIds: vi.fn(async () => []),
    };

    const orch = new GetNewsItemsByIdsOrchestrator(repository);
    await expect(orch.run({ ids: [0, 1] })).rejects.toThrow(/positive integers/i);
  });
});

