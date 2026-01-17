import type { Logger } from "../../../shared/observability/logger";
import type { PublishDigestResult } from "../dto/PublishDigestResult";
import type { DigestPostAssemblerPort } from "../ports/DigestPostAssemblerPort";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";
import type { TextGenerationPort } from "../ports/TextGenerationPort";
import type { LlmConfigService } from "./LlmConfigService";
import { parseDigestItemsFromLlmResponse } from "./parseDigestItemsFromLlmResponse";

export interface PublishDigestDeps {
  readonly newsSelection: NewsSelectionPort;
  readonly textGenerator: TextGenerationPort;
  readonly llmConfigService: LlmConfigService;
  readonly publisher: MarkdownPublisherPort;
  readonly postAssembler: DigestPostAssemblerPort;
  readonly digestRepository: DigestRepositoryPort;
  readonly logger: Logger;
}

/**
 * Publishes a news digest from unprocessed `news_items`.
 *
 * Flow owner:
 * - select unprocessed news texts
 * - generate digest items via LLM (JSON array of strings)
 * - assemble a final post (header + bullets + footer)
 * - persist digest (pending)
 * - publish to external channel
 * - mark digest as published
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: CLI/API/Cron must call only this orchestrator.
 */
export class PublishDigestOrchestrator {
  private readonly newsSelection: NewsSelectionPort;
  private readonly textGenerator: TextGenerationPort;
  private readonly llmConfigService: LlmConfigService;
  private readonly publisher: MarkdownPublisherPort;
  private readonly postAssembler: DigestPostAssemblerPort;
  private readonly digestRepository: DigestRepositoryPort;
  private readonly logger: Logger;

  public constructor(deps: PublishDigestDeps) {
    this.newsSelection = deps.newsSelection;
    this.textGenerator = deps.textGenerator;
    this.llmConfigService = deps.llmConfigService;
    this.publisher = deps.publisher;
    this.postAssembler = deps.postAssembler;
    this.digestRepository = deps.digestRepository;
    this.logger = deps.logger;
  }

  /**
   * Executes one publish-digest run.
   */
  public async run(): Promise<PublishDigestResult> {
    const startedAt = Date.now();
    this.logger.info("publishing:digest:start", {});

    const selectionStrings = await this.newsSelection.findUnprocessedNewsTexts();
    if (selectionStrings.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("publishing:digest:early-exit:no-unprocessed-items", { durationMs });
      return {
        selectedNewsCount: 0,
        digestId: null,
        isPublished: false,
        durationMs,
      };
    }

    const selected = selectionStrings.map(parseSelectedNewsItemString);
    const sourceItemIds = selected.map((s) => s.id);
    const sourceNewsTexts = selected.map((s) => s.rawText);

    const llmCfg = this.llmConfigService.loadOrThrow();
    if (!llmCfg.ok) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("publishing:digest:early-exit:invalid-llm-config", {
        selectedNewsCount: selectionStrings.length,
        error: llmCfg.error,
        durationMs,
      });
      return {
        selectedNewsCount: selectionStrings.length,
        digestId: null,
        isPublished: false,
        durationMs,
      };
    }

    const prompt = buildDigestPrompt({ instructions: llmCfg.config.instructions, newsTexts: sourceNewsTexts });
    const generated = await this.textGenerator.generateText({ prompt, model: llmCfg.config.model });

    const digestItems = parseDigestItemsFromLlmResponse(generated.text);
    const postText = this.postAssembler.assemblePost({ items: digestItems });

    const persisted = await this.digestRepository.createPendingDigest({
      digestText: postText,
      sourceItemIds,
      sourceNewsTexts,
      ...(generated.model ? { llmModel: generated.model } : {}),
    });

    if (digestItems.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("publishing:digest:early-exit:no-digest-items", {
        selectedNewsCount: selectionStrings.length,
        digestId: persisted.digestId,
        durationMs,
      });
      return {
        selectedNewsCount: selectionStrings.length,
        digestId: persisted.digestId,
        isPublished: false,
        durationMs,
      };
    }

    const published = await this.publisher.publishMarkdown({ text: postText });

    await this.digestRepository.markDigestPublished({
      digestId: persisted.digestId,
      finalDigestText: postText,
      ...(published.externalId ? { publisherExternalId: published.externalId } : {}),
    });

    const durationMs = Date.now() - startedAt;
    this.logger.info("publishing:digest:done", {
      selectedNewsCount: selectionStrings.length,
      digestId: persisted.digestId,
      durationMs,
    });

    return {
      selectedNewsCount: selectionStrings.length,
      digestId: persisted.digestId,
      isPublished: true,
      durationMs,
    };
  }
}

type SelectedNewsItem = {
  readonly id: number;
  readonly rawText: string;
};

function parseSelectedNewsItemString(value: string): SelectedNewsItem {
  // Deterministic and strict: avoid silently losing traceability.
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("NewsSelectionPort must return JSON strings: failed to parse selected item.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("NewsSelectionPort must return JSON strings: expected an object.");
  }

  const id = (parsed as { readonly id?: unknown }).id;
  const rawText = (parsed as { readonly rawText?: unknown }).rawText;

  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new Error("NewsSelectionPort must return JSON strings: expected a positive integer `id`.");
  }
  if (typeof rawText !== "string") {
    throw new Error("NewsSelectionPort must return JSON strings: expected a string `rawText`.");
  }

  return { id, rawText };
}

function buildDigestPrompt(input: { readonly instructions: string; readonly newsTexts: ReadonlyArray<string> }): string {
  // Keep prompt assembly deterministic for debuggability and test stability.
  return `${input.instructions}\n${JSON.stringify(input.newsTexts)}`;
}

