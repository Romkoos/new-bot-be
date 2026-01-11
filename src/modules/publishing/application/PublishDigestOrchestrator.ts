import type { Logger } from "../../../shared/observability/logger";
import type { PublishDigestResult } from "../dto/PublishDigestResult";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";
import type { TextGenerationPort } from "../ports/TextGenerationPort";
import { normalizeDigestText } from "./normalizeDigestText";

export interface PublishDigestDeps {
  readonly newsSelection: NewsSelectionPort;
  readonly textGenerator: TextGenerationPort;
  readonly publisher: MarkdownPublisherPort;
  readonly digestRepository: DigestRepositoryPort;
  readonly logger: Logger;
}

/**
 * Publishes a news digest from unprocessed `news_items`.
 *
 * Flow owner:
 * - select unprocessed news texts
 * - generate digest via LLM
 * - normalize digest text (minimal, deterministic)
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
  private readonly publisher: MarkdownPublisherPort;
  private readonly digestRepository: DigestRepositoryPort;
  private readonly logger: Logger;

  public constructor(deps: PublishDigestDeps) {
    this.newsSelection = deps.newsSelection;
    this.textGenerator = deps.textGenerator;
    this.publisher = deps.publisher;
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

    const prompt = buildDigestPrompt(sourceNewsTexts);
    const generated = await this.textGenerator.generateText({ prompt });
    const normalized = normalizeDigestText(generated.text);

    const persisted = await this.digestRepository.createPendingDigest({
      digestText: normalized,
      sourceItemIds,
      sourceNewsTexts,
      ...(generated.model ? { llmModel: generated.model } : {}),
    });

    const published = await this.publisher.publishMarkdown({ text: normalized });

    await this.digestRepository.markDigestPublished({
      digestId: persisted.digestId,
      finalDigestText: normalized,
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

function buildDigestPrompt(newsTexts: ReadonlyArray<string>): string {
  // Keep prompt assembly deterministic for debuggability and test stability.
  const header =
    "You are a news editor.\n" +
    "Your task is to filter news by their level of interest and write professional digests.\n" +
    "\n" +
    "Your writing style should target a young audience. Do not use profanity, but you may use slang where appropriate. In news of a tragic nature, slang is likely inappropriate.\n" +
    "\n" +
    "Below is an array of strings in Hebrew. Each string represents a news item. You should:\n" +
    "\n" +
    "translate these news items into Russian;\n" +
    "\n" +
    "filter out entries that do not contain actual news content;\n" +
    "\n" +
    "filter out uninteresting or completely trivial news, such as “a 36-year-old man fell off a scooter”;\n" +
    "\n" +
    "compose a news digest consisting of a headline and one sentence;\n" +
    "\n" +
    "format the result in Markdown.\n";

  return `${header}\n${JSON.stringify(newsTexts)}`;
}

