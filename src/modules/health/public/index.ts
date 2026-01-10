import { SystemTimeAdapter } from "../adapters/SystemTimeAdapter";
import { GetHealthStatusOrchestrator } from "../application/GetHealthStatusOrchestrator";
import { TimePort } from "../ports/TimePort";

export type { GetHealthStatusResponse } from "../dto/GetHealthStatusResponse";
export type { TimePort } from "../ports/TimePort";

/**
 * Public API export for the health use-case orchestrator.
 *
 * NOTE: App-layer entry points (`src/app/*`) must import from this module Public API
 * and must not deep-import internal module files.
 */
export { GetHealthStatusOrchestrator };

/**
 * Factory for a `TimePort` implementation backed by system time.
 *
 * This lets the composition root choose and create the adapter without deep-importing
 * module internals (adapters remain internal to the module).
 */
export function createSystemTimePort(): TimePort {
  return new SystemTimeAdapter();
}

