import type { CatalogResult, LlmCatalogService, LlmModelDto } from "./LlmCatalogService";

export type ListModelsByLlmIdInput = {
  readonly llmId: number;
};

/**
 * Lists models for a given LLM provider.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class ListModelsByLlmIdOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: ListModelsByLlmIdInput): Promise<CatalogResult<ReadonlyArray<LlmModelDto>>> {
    return this.catalog.listModelsByLlmId(input);
  }
}

