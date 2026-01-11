import { describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { PublishedAtResolver } from "../adapters/PublishedAtResolver";
import type { UtcIsoTimestampFormatterPort } from "../../../shared/ports/UtcIsoTimestampFormatterPort";

const TZ = "Asia/Jerusalem";

function createFormatter(): UtcIsoTimestampFormatterPort {
  return {
    nowUtcIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
    formatUtcIso: vi.fn((d: Date) => d.toISOString()),
  };
}

function createResolver(nowInTzIso: string): PublishedAtResolver {
  const timestampFormatter = createFormatter();
  return new PublishedAtResolver({
    timestampFormatter,
    timezoneId: TZ,
    now: () => DateTime.fromISO(nowInTzIso, { zone: TZ }),
  });
}

describe("PublishedAtResolver", () => {
  it("resolves HH:mm as 'today' in the configured timezone", () => {
    // 2026-01-11 in Israel is UTC+02:00, so 10:52 IL => 08:52Z
    const resolver = createResolver("2026-01-11T12:00:00.000");
    expect(resolver.resolveIsoOrNull("10:52")).toBe("2026-01-11T08:52:00.000Z");
  });

  it("applies midnight rollover: scraped 23:xx + now 00:xx => yesterday", () => {
    // now IL: 2026-01-11 00:25 => scraped 23:55 should be 2026-01-10 23:55 IL => 21:55Z
    const resolver = createResolver("2026-01-11T00:25:00.000");
    expect(resolver.resolveIsoOrNull("23:55")).toBe("2026-01-10T21:55:00.000Z");
  });

  it("handles month boundaries correctly for the rollover rule", () => {
    // now IL: 2026-02-01 00:05 => scraped 23:55 should be 2026-01-31 23:55 IL => 21:55Z
    const resolver = createResolver("2026-02-01T00:05:00.000");
    expect(resolver.resolveIsoOrNull("23:55")).toBe("2026-01-31T21:55:00.000Z");
  });

  it("is tolerant to extra text around HH:mm", () => {
    const resolver = createResolver("2026-01-11T12:00:00.000");
    expect(resolver.resolveIsoOrNull("  time: 10:52 • ")).toBe("2026-01-11T08:52:00.000Z");
  });

  it("returns null for invalid inputs", () => {
    const resolver = createResolver("2026-01-11T12:00:00.000");
    expect(resolver.resolveIsoOrNull("")).toBeNull();
    expect(resolver.resolveIsoOrNull("nope")).toBeNull();
    expect(resolver.resolveIsoOrNull("99:00")).toBeNull();
    expect(resolver.resolveIsoOrNull("10:99")).toBeNull();
  });
});

