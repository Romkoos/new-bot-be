import type { DigestDto } from "../dto/DigestDto";
import type { DigestReadPort } from "../ports/DigestReadPort";

/**
 * Lists previously created digests.
 *
 * Placement rule: orchestrators live only in `src/modules/MODULE_NAME/application`.
 * Entry-point rule: API/Cron/CLI must call only orchestrators (no persistence access directly).
 */
export class ListDigestsOrchestrator {
  private readonly digests: DigestReadPort;

  public constructor(digests: DigestReadPort) {
    this.digests = digests;
  }

  /**
   * Returns digests ordered by newest first (adapter-defined).
   */
  public async run(): Promise<ReadonlyArray<DigestDto>> {
    return this.digests.listDigests();
  }
}

