import type { Logger } from "../../../shared/observability/logger";
import type { PublishDigestResult } from "../dto/PublishDigestResult";
import type { DigestPostAssemblerPort } from "../ports/DigestPostAssemblerPort";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";
import type { TextGenerationPort } from "../ports/TextGenerationPort";
import { parseDigestItemsFromLlmResponse } from "./parseDigestItemsFromLlmResponse";

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

function buildDigestPrompt(newsTexts: ReadonlyArray<string>): string {
  // Keep prompt assembly deterministic for debuggability and test stability.
  const header =
    "You are a professional news editor and curator.\n" +
    "Your task is to STRICTLY filter, normalize, group, and summarize news items.\n" +
    "\n" +
    "Your target audience is young adults.\n" +
    "Writing style: clear, concise, professional.\n" +
    "Do NOT use profanity.\n" +
    "Slang is allowed ONLY if it does not reduce clarity or seriousness.\n" +
    "In tragic, violent, or sensitive news, slang is STRICTLY FORBIDDEN.\n" +
    "\n" +
    "Below is an array of strings in Hebrew.\n" +
    "Each string MAY represent a news item, noise, metadata, or irrelevant text.\n" +
    "\n" +
    "YOU MUST FOLLOW ALL RULES BELOW EXACTLY.\n" +
    "\n" +
    "STEP 1 — TRANSLATION:\n" +
    "- Translate ALL candidate news items from Hebrew into Russian.\n" +
    "- If a string cannot be clearly translated into meaningful Russian news content, DISCARD it.\n" +
    "\n" +
    "STEP 2 — HARD FILTERING (MANDATORY):\n" +
    "IMMEDIATELY DISCARD an item if ANY of the following is true:\n" +
    "- It does NOT describe a real-world event.\n" +
    "- It contains no clear subject, action, and outcome.\n" +
    "- It is a fragment, headline without context, clickbait stub, or metadata.\n" +
    "- It describes a single minor incident with no public, political, social, or economic relevance.\n" +
    "- It is a trivial, everyday, or local event with no public significance.\n" +
    "- Examples of MUST-BE-DISCARDED news:\n" +
    "  * minor accidents with no consequences\n" +
    "  * isolated everyday incidents.\n" +
    "  * personal misfortune of a single non-public individual\n" +
    "  * routine police reports without broader impact\n" +
    "\n" +
    "STEP 3 — INTEREST FILTERING (STRICT):\n" +
    "KEEP an item ONLY if it has at least ONE of the following qualities:\n" +
    "- affects a large group of people\n" +
    "- involves public figures, government, military, economy, tech, culture, or major companies\n" +
    "- has social, political, economic, or security implications\n" +
    "- represents an unusual, non-routine event\n" +
    "\n" +
    "STEP 4 — TOPIC GROUPING (MANDATORY):\n" +
    "- Before writing the digest, analyze ALL remaining news items.\n" +
    "- Group items by TOPIC if they clearly belong to the same theme.\n" +
    "- Examples of valid grouping:\n" +
    "  * several updates about one military conflict\n" +
    "  * multiple political decisions within one country\n" +
    "  * a sequence of events around one company or technology\n" +
    "- If grouping is possible, YOU MUST merge them.\n" +
    "- Do NOT create artificial groups.\n" +
    "- If grouping is NOT logically possible, keep items separate.\n" +
    "\n" +
    "STEP 5 — DIGEST COMPOSITION:\n" +
    "- Each digest item MUST consist of:\n" +
    "  * ONE clear headline\n" +
    "  * ONE concise explanatory sentence\n" +
    "- If a digest item represents a GROUP of news:\n" +
    "  * the headline MUST reflect the common theme\n" +
    "  * the sentence MUST summarize the combined essence, not list events\n" +
    "- Do NOT mention sources.\n" +
    "- Do NOT add opinions.\n" +
    "- Do NOT add assumptions or speculation.\n" +
    "\n" +
    "OUTPUT RULES (ABSOLUTE):\n" +
    "- Return ONLY a JSON array of strings.\n" +
    "- Each array element = ONE digest item (headline + one sentence).\n" +
    "- NO extra text.\n" +
    "- NO explanations.\n" +
    "- NO markdown.\n" +
    "- NO comments.\n" +
    "- If no valid news remains, return an EMPTY JSON array: [].\n";


  return `${header}\n${JSON.stringify(newsTexts)}`;
}

