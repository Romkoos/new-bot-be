import type { FilterDto } from "../dto/FilterDto";
import type { FiltersCatalogService } from "./FiltersCatalogService";
import type { FiltersResult } from "./FiltersResult";

export type UpdateFilterInput = {
  readonly id: number;
  readonly name?: string;
  readonly pattern?: string;
};

/**
 * Updates a regex filter.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators.
 */
export class UpdateFilterOrchestrator {
  private readonly catalog: FiltersCatalogService;

  public constructor(catalog: FiltersCatalogService) {
    this.catalog = catalog;
  }

  public async run(input: UpdateFilterInput): Promise<FiltersResult<FilterDto>> {
    if (input.name === undefined && input.pattern === undefined) {
      return { ok: false, error: "At least one of name or pattern must be provided." };
    }

    if (input.name !== undefined && !input.name.trim()) {
      return { ok: false, error: "name must be a non-empty string when provided." };
    }

    if (input.pattern !== undefined) {
      const validation = validateRegexPattern(input.pattern);
      if (!validation.ok) return validation;
    }

    return this.catalog.updateFilter({
      id: input.id,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.pattern !== undefined ? { pattern: input.pattern } : {}),
    });
  }
}

function validateRegexPattern(pattern: string): FiltersResult<true> {
  if (!pattern.trim()) return { ok: false, error: "pattern must be a non-empty string when provided." };
  try {
    // Compile to validate only. We do not store compiled regex instances.
    RegExp(pattern, "u");
    return { ok: true, value: true };
  } catch (error) {
    return { ok: false, error: `Invalid regex pattern: ${String(error)}` };
  }
}

