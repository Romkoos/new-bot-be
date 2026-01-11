import type { MarkdownPublisherPort } from "../ports/MarkdownPublisherPort";
import type { Logger } from "../../../shared/observability/logger";

type TelegramParseMode = "MarkdownV2" | "Markdown" | "HTML";

/**
 * Telegram-based implementation of {@link MarkdownPublisherPort}.
 *
 * Provider-specific details (bot token, chat id, parse modes) are intentionally confined to this adapter.
 */
export class TelegramMarkdownPublisher implements MarkdownPublisherPort {
  private readonly token: string;
  private readonly chatId: string;
  private readonly parseMode: TelegramParseMode | undefined;
  private readonly disablePreview: boolean;
  private readonly logger: Logger | undefined;

  public constructor(params: { readonly env: NodeJS.ProcessEnv; readonly logger?: Logger }) {
    const token = params.env.TELEGRAM_BOT_TOKEN;
    const chatId = params.env.TELEGRAM_CHAT_ID;
    if (!token) throw new Error("TelegramMarkdownPublisher: TELEGRAM_BOT_TOKEN is required.");
    if (!chatId) throw new Error("TelegramMarkdownPublisher: TELEGRAM_CHAT_ID is required.");

    this.token = token;
    this.chatId = chatId;
    this.logger = params.logger ?? undefined;

    const parseMode = params.env.TELEGRAM_PARSE_MODE?.trim();
    if (parseMode === "MarkdownV2" || parseMode === "Markdown" || parseMode === "HTML") {
      this.parseMode = parseMode;
    } else if (!parseMode) {
      this.parseMode = undefined;
    } else {
      throw new Error(`TelegramMarkdownPublisher: unsupported TELEGRAM_PARSE_MODE "${parseMode}".`);
    }

    this.disablePreview = parseEnvBool(params.env.TELEGRAM_DISABLE_PREVIEW, false);
  }

  public async publishMarkdown(input: { readonly text: string }): Promise<{ readonly externalId?: string }> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const text = this.parseMode === "MarkdownV2" ? escapeTelegramMarkdownV2(input.text) : input.text;

    this.logger?.info("telegram:sendMessage:request", {
      chatId: redactChatId(this.chatId),
      parseMode: this.parseMode ?? null,
      disablePreview: this.disablePreview,
      originalTextLength: input.text.length,
      finalTextLength: text.length,
      finalTextPreview: truncate(text, 300),
    });

    const payload: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
      disable_web_page_preview: this.disablePreview,
      ...(this.parseMode ? { parse_mode: this.parseMode } : {}),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    this.logger?.info("telegram:sendMessage:response", {
      status: res.status,
      ok: res.ok,
      bodyPreview: truncate(bodyText, 1000),
    });
    if (!res.ok) {
      throw new Error(`TelegramMarkdownPublisher: sendMessage failed (${res.status}): ${bodyText}`);
    }

    // Best-effort parse to return a stable external id.
    try {
      const json = JSON.parse(bodyText) as {
        readonly ok?: boolean;
        readonly result?: { readonly message_id?: number };
      };
      const messageId = json?.result?.message_id;
      if (typeof messageId === "number") return { externalId: String(messageId) };
    } catch {
      // ignore
    }

    return {};
  }
}

function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

function redactChatId(chatId: string): string {
  // Preserve enough to correlate configs, but avoid dumping full identifiers into logs.
  const trimmed = chatId.trim();
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-3)}`;
}

/**
 * Escapes text for Telegram `MarkdownV2` parse mode.
 *
 * This is intentionally deterministic and conservative:
 * - Escapes all MarkdownV2-reserved characters to avoid Telegram API failures.
 * - This may reduce formatting fidelity, but makes publishing reliable.
 */
function escapeTelegramMarkdownV2(text: string): string {
  // Escape backslashes first to avoid double-escaping.
  const escapedSlashes = text.replace(/\\/g, "\\\\");
  return escapedSlashes.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

