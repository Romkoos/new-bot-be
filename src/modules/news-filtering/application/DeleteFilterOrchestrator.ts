import type { FiltersCatalogService } from "./FiltersCatalogService";
import type { FiltersResult } from "./FiltersResult";

export type DeleteFilterInput = {
  readonly id: number;
};

/**
 * Deletes a regex filter.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class DeleteFilterOrchestrator {
  private readonly catalog: FiltersCatalogService;

  public constructor(catalog: FiltersCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: DeleteFilterInput): Promise<FiltersResult<{ readonly deleted: true }>> {
    return this.catalog.deleteFilter(input);
  }
}

