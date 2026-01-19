import type { CatalogResult, LlmCatalogService, LlmModelDto } from "./LlmCatalogService";

export type CreateLlmModelInput = {
  readonly llmId: number;
  readonly name: string;
};

/**
 * Creates a model linked to an existing LLM provider.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class CreateLlmModelOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: CreateLlmModelInput): Promise<CatalogResult<LlmModelDto>> {
    return this.catalog.createModel(input);
  }
}

