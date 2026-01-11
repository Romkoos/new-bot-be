import type { Logger } from "../../../shared/observability/logger";
import type { PrepareContentResult } from "../dto/PrepareContentResult";
import type { ContentProcessorPort } from "../ports/ContentProcessorPort";
import type { ContentPreparationRepositoryPort } from "../ports/ContentPreparationRepositoryPort";

export interface PrepareContentDeps {
  readonly repository: ContentPreparationRepositoryPort;
  readonly processor: ContentProcessorPort;
  readonly logger: Logger;
}

/**
 * Prepares content for publication from unprocessed `news_items`.
 *
 * This orchestrator owns the full use-case flow:
 * read unprocessed → process → persist prepared content → mark processed
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: CLI/API/Cron must call only this orchestrator and must not embed the flow.
 */
export class PrepareContentOrchestrator {
  private readonly repository: ContentPreparationRepositoryPort;
  private readonly processor: ContentProcessorPort;
  private readonly logger: Logger;

  public constructor(deps: PrepareContentDeps) {
    this.repository = deps.repository;
    this.processor = deps.processor;
    this.logger = deps.logger;
  }

  /**
   * Executes one content preparation run.
   */
  public async run(): Promise<PrepareContentResult> {
    const startedAt = Date.now();
    this.logger.info("content:prepare:start", {});

    const items = await this.repository.findUnprocessedNewsItems();
    if (items.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("content:prepare:early-exit:no-unprocessed-items", { durationMs });
      return {
        sourceItemsCount: 0,
        preparedStringsCount: 0,
        preparedContentId: null,
        markedProcessedCount: 0,
        durationMs,
      };
    }

    const preparedStrings = this.processor.process(items);

    const payloadJson = JSON.stringify({
      preparedStrings,
      // Traceability metadata (what this run used as inputs).
      sourceItemIds: items.map((i) => i.id),
    });

    const persisted = await this.repository.persistPreparedContentAndMarkProcessed({
      sourceItemIds: items.map((i) => i.id),
      sourceItemsCount: items.length,
      payloadJson,
    });

    const durationMs = Date.now() - startedAt;
    this.logger.info("content:prepare:done", {
      sourceItemsCount: items.length,
      preparedStringsCount: preparedStrings.length,
      preparedContentId: persisted.preparedContentId,
      markedProcessedCount: persisted.markedProcessedCount,
      durationMs,
    });

    return {
      sourceItemsCount: items.length,
      preparedStringsCount: preparedStrings.length,
      preparedContentId: persisted.preparedContentId,
      markedProcessedCount: persisted.markedProcessedCount,
      durationMs,
    };
  }
}

