import type { GetHealthStatusResponse } from "../dto/GetHealthStatusResponse";
import type { TimePort } from "../ports/TimePort";

/*
 * Use-case orchestrator for the Health Status flow.
 *
 * Orchestrators:
 * - live only in `modules/MODULE_NAME/application`
 * - define execution order and flow
 * - depend only on ports and public APIs (no adapters, no app layer)
 */
export class GetHealthStatusOrchestrator {
  public constructor(private readonly timePort: TimePort) {}

  /**
   * Returns the current health status.
   */
  public run(): GetHealthStatusResponse {
    const time = this.timePort.nowIso();
    return { status: "ok", time };
  }
}

