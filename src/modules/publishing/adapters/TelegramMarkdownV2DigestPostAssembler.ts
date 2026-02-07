import type { DigestPostAssemblerPort } from "../ports/DigestPostAssemblerPort";

const CHANNEL_URL = "https://t.me/yalla_balagan_news";
const HEADER_TITLE = "Йалла дайджест!";
const FOOTER_TITLE = "Йалла балаган | Новости";

/**
 * Assembles a Telegram-ready digest post in `MarkdownV2`.
 *
 * Output shape:
 * - escaped header title (skipped when there is exactly one item)
 * - blank line
 * - escaped bulleted list (each item is one digest entry)
 * - blank line
 * - footer as a MarkdownV2 link: `[escapedLabel](rawUrl)`
 *
 * Notes:
 * - URL is intentionally not escaped.
 * - This adapter is deterministic and conservative: it escapes all MarkdownV2-reserved characters.
 */
export class TelegramMarkdownV2DigestPostAssembler implements DigestPostAssemblerPort {
  public assemblePost(input: { readonly items: ReadonlyArray<string> }): string {
    const normalizedItems = input.items
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .map((x) => `\\- ${escapeMdV2(x)}`);

    const shouldIncludeHeader = normalizedItems.length !== 1;
    const footer = buildFooter();

    const sections: Array<string> = [];
    if (shouldIncludeHeader) {
      sections.push(escapeMdV2(HEADER_TITLE));
    }
    if (normalizedItems.length > 0) {
      sections.push(normalizedItems.join("\n"));
    }
    sections.push(footer);

    // Keep formatting stable and predictable for debugging.
    return sections.join("\n\n").trim();
  }
}

function buildFooter(): string {
  const label = escapeMdV2(FOOTER_TITLE);
  // Do NOT escape the URL.
  return `[${label}](${CHANNEL_URL})`;
}

function escapeMdV2(text: string): string {
  // Telegram MarkdownV2 reserved chars: _ * [ ] ( ) ~ ` > # + - = | { } . ! and backslash.
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

