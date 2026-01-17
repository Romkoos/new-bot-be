import type { LlmConfigResult, LlmConfigService } from "./LlmConfigService";

export type UpsertLlmConfigInput = {
  readonly model: string;
  readonly instructions: string;
};

/**
 * Creates or updates the single-row LLM configuration.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class UpsertLlmConfigOrchestrator {
  private readonly llmConfigService: LlmConfigService;

  public constructor(llmConfigService: LlmConfigService) {
    this.llmConfigService = llmConfigService;
  }

  /**
   * Upserts the single config row (`id=1`).
   *
   * Validation is intentionally minimal: model and instructions must be non-empty strings.
   */
  public async run(input: UpsertLlmConfigInput): Promise<LlmConfigResult> {
    return this.llmConfigService.upsert(input);
  }
}

