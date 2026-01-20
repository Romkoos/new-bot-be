import type { FilterDto } from "../dto/FilterDto";
import type { FiltersCatalogService } from "./FiltersCatalogService";
import type { FiltersResult } from "./FiltersResult";

/**
 * Lists all regex filters.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class ListFiltersOrchestrator {
  private readonly catalog: FiltersCatalogService;

  public constructor(catalog: FiltersCatalogService) {
    this.catalog = catalog;
  }

  public async run(): Promise<FiltersResult<ReadonlyArray<FilterDto>>> {
    return this.catalog.listFilters();
  }
}

