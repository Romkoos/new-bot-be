import { describe, expect, it, vi } from "vitest";
import { ListDigestsOrchestrator } from "../application/ListDigestsOrchestrator";
import type { DigestDto } from "../dto/DigestDto";
import type { DigestReadPort } from "../ports/DigestReadPort";

describe("ListDigestsOrchestrator", () => {
  it("returns digests from the read port", async () => {
    const digests: DigestDto[] = [
      {
        id: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        digest_text: "hello",
        is_published: 0,
        source_item_ids_json: "[1,2]",
        llm_model: null,
        published_at: null,
      },
    ];

    const port: DigestReadPort = {
      listDigests: vi.fn(async () => digests),
    };

    const orch = new ListDigestsOrchestrator(port);
    await expect(orch.run()).resolves.toEqual(digests);
    expect(port.listDigests).toHaveBeenCalledTimes(1);
  });
});

