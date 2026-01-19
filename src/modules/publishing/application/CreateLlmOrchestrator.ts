import type { CatalogResult, LlmCatalogService, LlmDto } from "./LlmCatalogService";

export type CreateLlmInput = {
  readonly name: string;
  readonly alias: string;
};

/**
 * Creates an LLM provider in the catalog.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class CreateLlmOrchestrator {
  private readonly catalog: LlmCatalogService;

  public constructor(catalog: LlmCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: CreateLlmInput): Promise<CatalogResult<LlmDto>> {
    return this.catalog.createLlm(input);
  }
}

