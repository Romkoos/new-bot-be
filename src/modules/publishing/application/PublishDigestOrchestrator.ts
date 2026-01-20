import type { Logger } from "../../../shared/observability/logger";
import type { PublishDigestResult } from "../dto/PublishDigestResult";
import type { DigestPostAssemblerPort } from "../ports/DigestPostAssemblerPort";
import type { DigestRepositoryPort } from "../ports/DigestRepositoryPort";
import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { NewsItemFlagsPort } from "../ports/NewsItemFlagsPort";
import type { NewsSelectionPort } from "../ports/NewsSelectionPort";
import type { TextGenerationPort } from "../ports/TextGenerationPort";
import type { LlmConfigService } from "./LlmConfigService";
import { parseDigestItemsFromLlmResponse } from "./parseDigestItemsFromLlmResponse";
import type { FilterDto, FiltersResult, ListFiltersOrchestrator } from "../../news-filtering/public";

export interface PublishDigestDeps {
  readonly newsSelection: NewsSelectionPort;
  readonly newsItemFlags: NewsItemFlagsPort;
  /**
   * Lists all configured regex filters.
   *
   * This dependency is injected from the `news-filtering` module via its Public API.
   *
   * NOTE: This is optional temporarily to keep compilation stable until DI wiring is updated.
   * It MUST be provided in production for filtering to be applied.
   */
  readonly listFiltersOrchestrator?: ListFiltersOrchestrator;
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
  private readonly newsItemFlags: NewsItemFlagsPort;
  private readonly listFiltersOrchestrator?: ListFiltersOrchestrator;
  private readonly textGenerator: TextGenerationPort;
  private readonly llmConfigService: LlmConfigService;
  private readonly publisher: MarkdownPublisherPort;
  private readonly postAssembler: DigestPostAssemblerPort;
  private readonly digestRepository: DigestRepositoryPort;
  private readonly logger: Logger;

  public constructor(deps: PublishDigestDeps) {
    this.newsSelection = deps.newsSelection;
    this.newsItemFlags = deps.newsItemFlags;
    this.listFiltersOrchestrator = deps.listFiltersOrchestrator;
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
    const filtersResult = await this.loadFilters();
    const filterMatchers = compileFilterMatchers(filtersResult);

    const itemsToFinalize: Array<{ id: number; filterIds: ReadonlyArray<number> }> = [];
    const digestCandidates: SelectedNewsItem[] = [];

    for (const item of selected) {
      // If an item was already marked filtered in storage, never include it in the digest.
      // Still, we must mark it as processed so it stops reappearing.
      if (item.filtered === 1) {
        itemsToFinalize.push({ id: item.id, filterIds: item.filtersIds });
        continue;
      }

      const matchedFilterIds = matchFilterIds({ text: item.rawText, matchers: filterMatchers });
      if (matchedFilterIds.length > 0) {
        itemsToFinalize.push({ id: item.id, filterIds: matchedFilterIds });
        continue;
      }

      digestCandidates.push(item);
    }

    if (itemsToFinalize.length > 0) {
      await this.newsItemFlags.markItemsFilteredAndProcessed({ items: itemsToFinalize });
    }

    if (digestCandidates.length === 0) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("publishing:digest:early-exit:all-items-filtered", {
        selectedUnprocessedCount: selectionStrings.length,
        filteredCount: itemsToFinalize.length,
        durationMs,
      });
      return {
        selectedNewsCount: 0,
        digestId: null,
        isPublished: false,
        durationMs,
      };
    }

    const sourceItemIds = digestCandidates.map((s) => s.id);
    const sourceNewsTexts = digestCandidates.map((s) => s.rawText);

    const llmCfg = this.llmConfigService.loadOrThrow();
    if (!llmCfg.ok) {
      const durationMs = Date.now() - startedAt;
      this.logger.info("publishing:digest:early-exit:invalid-llm-config", {
        selectedNewsCount: digestCandidates.length,
        error: llmCfg.error,
        durationMs,
      });
      return {
        selectedNewsCount: digestCandidates.length,
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
        selectedNewsCount: digestCandidates.length,
        digestId: persisted.digestId,
        durationMs,
      });
      return {
        selectedNewsCount: digestCandidates.length,
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
      selectedNewsCount: digestCandidates.length,
      digestId: persisted.digestId,
      durationMs,
    });

    return {
      selectedNewsCount: digestCandidates.length,
      digestId: persisted.digestId,
      isPublished: true,
      durationMs,
    };
  }

  private async loadFilters(): Promise<FiltersResult<ReadonlyArray<FilterDto>>> {
    if (!this.listFiltersOrchestrator) {
      this.logger.warn("publishing:digest:filters:not-configured", {});
      return { ok: true, value: [] };
    }

    try {
      const res = await this.listFiltersOrchestrator.run();
      if (!res.ok) {
        this.logger.warn("publishing:digest:filters:load-failed", { error: res.error });
        return { ok: true, value: [] };
      }
      return res;
    } catch (error) {
      this.logger.warn("publishing:digest:filters:load-threw", { error: String(error) });
      return { ok: true, value: [] };
    }
  }
}

type SelectedNewsItem = {
  readonly id: number;
  readonly rawText: string;
  readonly filtered: 0 | 1;
  readonly filtersIds: ReadonlyArray<number>;
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
  const filtered = (parsed as { readonly filtered?: unknown }).filtered;
  const filtersIds = (parsed as { readonly filtersIds?: unknown }).filtersIds;

  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new Error("NewsSelectionPort must return JSON strings: expected a positive integer `id`.");
  }
  if (typeof rawText !== "string") {
    throw new Error("NewsSelectionPort must return JSON strings: expected a string `rawText`.");
  }

  const filteredFlag = filtered === 1 ? 1 : 0;
  const parsedFiltersIds = normalizeFilterIds(filtersIds);

  return { id, rawText, filtered: filteredFlag, filtersIds: parsedFiltersIds };
}

function buildDigestPrompt(input: { readonly instructions: string; readonly newsTexts: ReadonlyArray<string> }): string {
  // Keep prompt assembly deterministic for debuggability and test stability.
  return `${input.instructions}\n${JSON.stringify(input.newsTexts)}`;
}

function normalizeFilterIds(value: unknown): ReadonlyArray<number> {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    if (typeof v === "number" && Number.isInteger(v) && v > 0) out.push(v);
  }
  // Deterministic: unique + sort.
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

type FilterMatcher = { readonly id: number; readonly regex: RegExp };

function compileFilterMatchers(filtersResult: FiltersResult<ReadonlyArray<FilterDto>>): ReadonlyArray<FilterMatcher> {
  if (!filtersResult.ok) return [];
  const out: FilterMatcher[] = [];
  for (const f of filtersResult.value) {
    try {
      out.push({ id: f.id, regex: RegExp(f.pattern, "u") });
    } catch {
      // Ignore invalid patterns; creation/update APIs are expected to prevent this.
      continue;
    }
  }
  return out;
}

function matchFilterIds(input: { readonly text: string; readonly matchers: ReadonlyArray<FilterMatcher> }): ReadonlyArray<number> {
  const matched: number[] = [];
  for (const m of input.matchers) {
    if (m.regex.test(input.text)) matched.push(m.id);
  }
  return Array.from(new Set(matched)).sort((a, b) => a - b);
}
