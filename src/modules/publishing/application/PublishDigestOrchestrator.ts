import type { Logger } from "../../../shared/observability/logger";
import type { PublishDigestResult } from "../dto/PublishDigestResult";
import type { DigestPostAssemblerPort } from "../ports/DigestPostAssemblerPort";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";
import type { TextGenerationPort } from "../ports/TextGenerationPort";

export interface PublishDigestDeps {
  readonly newsSelection: NewsSelectionPort;
  readonly textGenerator: TextGenerationPort;
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
  private readonly publisher: MarkdownPublisherPort;
  private readonly postAssembler: DigestPostAssemblerPort;
  private readonly digestRepository: DigestRepositoryPort;
  private readonly logger: Logger;

  public constructor(deps: PublishDigestDeps) {
    this.newsSelection = deps.newsSelection;
    this.textGenerator = deps.textGenerator;
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

    const prompt = buildDigestPrompt(sourceNewsTexts);
    const generated = await this.textGenerator.generateText({ prompt });

    const digestItems = parseDigestItemsJson(generated.text);
    const postText = this.postAssembler.assemblePost({ items: digestItems });

    const persisted = await this.digestRepository.createPendingDigest({
      digestText: postText,
      sourceItemIds,
      sourceNewsTexts,
      ...(generated.model ? { llmModel: generated.model } : {}),
    });

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
    "IMPORTANT: translate these news items into Russian;\n" +
    "\n" +
    "filter out entries that do not contain actual news content;\n" +
    "\n" +
    "filter out uninteresting or completely trivial news, such as \"a 36-year-old man fell off a scooter\";\n" +
    "\n" +
    "compose a news digest consisting of a headline and one sentence;\n" +
    "\n" +
    "Return ONLY a JSON array of strings.\n" +
    "Each array element must be one digest item (one headline + one sentence).\n" +
    "Do not include any extra text before or after the JSON.\n";

  return `${header}\n${JSON.stringify(newsTexts)}`;
}

function parseDigestItemsJson(raw: string): ReadonlyArray<string> {
  const trimmed = raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error("LLM output must be a JSON array of strings: failed to parse JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM output must be a JSON array of strings: expected an array.");
  }

  const items: string[] = [];
  for (const v of parsed) {
    if (typeof v !== "string") {
      throw new Error("LLM output must be a JSON array of strings: array contained a non-string value.");
    }
    const t = v.trim();
    if (t.length === 0) continue;
    items.push(t);
  }

  if (items.length === 0) {
    throw new Error("LLM output JSON array contained no non-empty strings.");
  }

  return items;
}

