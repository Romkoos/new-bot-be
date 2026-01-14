import type { NewsItemDto } from "../dto/NewsItemDto";
import type { NewsItemsRepositoryPort } from "../ports/NewsItemsRepositoryPort";

export interface GetNewsItemsByIdsInput {
  /**
   * News item ids to fetch.
   *
   * Contract:
   * - ids are expected to be positive integers
   * - output array preserves the exact input order and length
   */
  readonly ids: ReadonlyArray<number>;
}

/**
 * Returns news items by id, preserving the input order.
 *
 * Missing ids are returned as `null` entries to keep positional mapping stable.
 */
export class GetNewsItemsByIdsOrchestrator {
  private readonly repo: NewsItemsRepositoryPort;

  public constructor(repo: NewsItemsRepositoryPort) {
    this.repo = repo;
  }

  public async run(input: GetNewsItemsByIdsInput): Promise<ReadonlyArray<NewsItemDto | null>> {
    if (input.ids.length === 0) return [];

    for (const id of input.ids) {
      if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
        throw new Error("GetNewsItemsByIdsOrchestrator: ids must be a list of positive integers.");
      }
    }

    // Adapter is free to return any row order; we rebuild deterministically.
    const rows = await this.repo.findByIds(input.ids);
    const byId = new Map<number, NewsItemDto>(rows.map((r) => [r.id, r]));

    return input.ids.map((id) => byId.get(id) ?? null);
  }
}

