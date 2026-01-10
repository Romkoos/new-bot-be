import { describe, expect, it } from "vitest";
import { GetHealthStatusOrchestrator } from "../application/GetHealthStatusOrchestrator";
import type { TimePort } from "../ports/TimePort";

describe("GetHealthStatusOrchestrator", () => {
  it("returns ok status with deterministic time from TimePort", () => {
    const timePort: TimePort = {
      nowIso: () => "2026-01-10T00:00:00.000Z",
    };

    const orchestrator = new GetHealthStatusOrchestrator(timePort);

    expect(orchestrator.run()).toEqual({
      status: "ok",
      time: "2026-01-10T00:00:00.000Z",
    });
  });
});

