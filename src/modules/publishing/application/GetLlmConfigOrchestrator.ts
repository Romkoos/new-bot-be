import type { LlmConfig, LlmConfigResult, LlmConfigService } from "./LlmConfigService";

/**
 * Returns the current LLM configuration.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class GetLlmConfigOrchestrator {
  private readonly llmConfigService: LlmConfigService;

  public constructor(llmConfigService: LlmConfigService) {
    this.llmConfigService = llmConfigService;
  }

  /**
   * Loads the single config row (`id=1`).
   *
   * @throws if the row does not exist (fatal misconfiguration).
   */
  public async run(): Promise<LlmConfigResult> {
    return this.llmConfigService.loadOrThrow();
  }
}

