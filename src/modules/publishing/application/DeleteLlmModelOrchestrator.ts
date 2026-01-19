import type { CatalogResult, LlmCatalogService } from "./LlmCatalogService";

export type DeleteLlmModelInput = {
  readonly id: number;
};

/**
 * Deletes a model from the catalog.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class DeleteLlmModelOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: DeleteLlmModelInput): Promise<CatalogResult<{ readonly deleted: true }>> {
    return this.catalog.deleteModel(input);
  }
}

