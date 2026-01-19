import type { CatalogResult, LlmCatalogService } from "./LlmCatalogService";

export type DeleteLlmInput = {
  readonly id: number;
};

/**
 * Deletes an LLM provider from the catalog.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class DeleteLlmOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: DeleteLlmInput): Promise<CatalogResult<{ readonly deleted: true }>> {
    return this.catalog.deleteLlm(input);
  }
}

