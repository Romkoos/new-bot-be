import type { FilterDto } from "../dto/FilterDto";
import type { FiltersCatalogService } from "./FiltersCatalogService";
import type { FiltersResult } from "./FiltersResult";

export type CreateFilterInput = {
  readonly name: string;
  readonly pattern: string;
};

/**
 * Creates a regex filter.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class CreateFilterOrchestrator {
  private readonly catalog: FiltersCatalogService;

  public constructor(catalog: FiltersCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: CreateFilterInput): Promise<FiltersResult<FilterDto>> {
    const validation = validateRegexPattern(input.pattern);
    if (!validation.ok) return validation;

    return this.catalog.createFilter(input);
  }
}

function validateRegexPattern(pattern: string): FiltersResult<true> {
  if (!pattern.trim()) return { ok: false, error: "pattern must be a non-empty string." };
  try {
    // Force Unicode mode for:
    // - Unicode property escapes (\p{...})
    // - correct code point semantics
    // Note: lookbehind support depends on the JS engine; Node 22 supports it.
    // Compile to validate only. We do not store compiled regex instances.
    RegExp(pattern, "u");
    return { ok: true, value: true };
  } catch (error) {
    return { ok: false, error: `Invalid regex pattern: ${String(error)}` };
  }
}

