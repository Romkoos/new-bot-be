import { describe, expect, it } from "vitest";
import { TelegramMarkdownV2DigestPostAssembler } from "../adapters/TelegramMarkdownV2DigestPostAssembler";

describe("TelegramMarkdownV2DigestPostAssembler", () => {
  it("includes a bold rocket header when there are 0 items", () => {
    const assembler = new TelegramMarkdownV2DigestPostAssembler();
    const post = assembler.assemblePost({ items: [] });

    expect(post).toBe(
      ["*🚀 Йалла дайджест\\!*", "[Йалла балаган \\| Новости](https://t.me/yalla_balagan_news)"].join("\n\n"),
    );
  });

  it("omits the header when there is exactly 1 item", () => {
    const assembler = new TelegramMarkdownV2DigestPostAssembler();
    const post = assembler.assemblePost({ items: ["Headline. Details"] });

    expect(post).toBe(
      ["\\- *Headline*\\. Details", "[Йалла балаган \\| Новости](https://t.me/yalla_balagan_news)"].join("\n\n"),
    );
    expect(post).not.toContain("Йалла дайджест");
  });

  it("adds exactly one empty line between items", () => {
    const assembler = new TelegramMarkdownV2DigestPostAssembler();
    const post = assembler.assemblePost({ items: ["A. one", "B. two"] });

    expect(post).toContain("\\- *A*\\. one\n\n\\- *B*\\. two");
    // Ensure we don't accidentally insert two empty lines between items.
    expect(post).not.toContain("\\- *A*\\. one\n\n\n\\- *B*\\. two");
  });

  it("bolds the headline part (before the first period) and escapes MarkdownV2 characters", () => {
    const assembler = new TelegramMarkdownV2DigestPostAssembler();
    const post = assembler.assemblePost({ items: ["A+B. wow!"] });

    expect(post).toContain("\\- *A\\+B*\\. wow\\!");
  });

  it("bolds the whole item when there is no period", () => {
    const assembler = new TelegramMarkdownV2DigestPostAssembler();
    const post = assembler.assemblePost({ items: ["Just headline!"] });

    expect(post).toContain("\\- *Just headline\\!*");
  });
});

