import type { TimePort } from "../ports/TimePort";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

/**
 * System adapter for the `TimePort` that reads the current wall-clock time.
 *
 * Note: This adapter is instantiated in the composition root (`src/app/di`).
 */
export class SystemTimeAdapter implements TimePort {
  public constructor(private readonly timestampFormatter: UtcIsoTimestampFormatterPort) {}

  public nowIso(): string {
    return this.timestampFormatter.nowUtcIso();
  }
}

