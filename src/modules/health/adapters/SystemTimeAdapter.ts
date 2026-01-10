import type { TimePort } from "../ports/TimePort";

/**
 * System adapter for the `TimePort` that reads the current wall-clock time.
 *
 * Note: This adapter is instantiated in the composition root (`src/app/di`).
 */
export class SystemTimeAdapter implements TimePort {
  public nowIso(): string {
    return new Date().toISOString();
  }
}

