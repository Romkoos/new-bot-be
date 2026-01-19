import type { CatalogResult, LlmCatalogService, LlmDto } from "./LlmCatalogService";

/**
 * Lists all configured LLM providers.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class ListLlmsOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(): Promise<CatalogResult<ReadonlyArray<LlmDto>>> {
    return this.catalog.listLlms();
  }
}

