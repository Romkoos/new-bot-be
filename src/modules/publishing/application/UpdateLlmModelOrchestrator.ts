import type { CatalogResult, LlmCatalogService, LlmModelDto } from "./LlmCatalogService";

export type UpdateLlmModelInput = {
  readonly id: number;
  readonly llmId?: number;
  readonly name?: string;
};

/**
 * Updates a model in the catalog (rename and/or relink to a different LLM).
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class UpdateLlmModelOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: UpdateLlmModelInput): Promise<CatalogResult<LlmModelDto>> {
    return this.catalog.updateModel(input);
  }
}

