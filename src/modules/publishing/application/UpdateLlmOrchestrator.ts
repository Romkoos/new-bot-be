import type { CatalogResult, LlmCatalogService, LlmDto } from "./LlmCatalogService";

export type UpdateLlmInput = {
  readonly id: number;
  readonly name?: string;
  readonly alias?: string;
};

/**
 * Updates an LLM provider in the catalog.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class UpdateLlmOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: UpdateLlmInput): Promise<CatalogResult<LlmDto>> {
    return this.catalog.updateLlm(input);
  }
}

