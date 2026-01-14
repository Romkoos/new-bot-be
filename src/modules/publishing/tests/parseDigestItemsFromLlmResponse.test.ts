import { describe, expect, it } from "vitest";
import { parseDigestItemsFromLlmResponse } from "../application/parseDigestItemsFromLlmResponse";

describe("parseDigestItemsFromLlmResponse", () => {
  it("parses plain JSON array of strings", () => {
    const items = parseDigestItemsFromLlmResponse('["a", " b ", ""]');
    expect(items).toEqual(["a", "b"]);
  });

  it("parses JSON array wrapped in ```json code fence", () => {
    const raw = "```json\n[\n  \"a\",\n  \"b\"\n]\n```";
    const items = parseDigestItemsFromLlmResponse(raw);
    expect(items).toEqual(["a", "b"]);
  });

  it("parses strict markdown bullets", () => {
    const raw = "- a\n- b\n";
    const items = parseDigestItemsFromLlmResponse(raw);
    expect(items).toEqual(["a", "b"]);
  });
});

