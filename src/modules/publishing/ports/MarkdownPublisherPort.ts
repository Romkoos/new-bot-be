/**
 * Port for publishing Markdown content to an external destination.
 *
 * Examples of destinations:
 * - chat/channel message (Telegram, Discord, etc.)
 * - CMS post
 * - email digest
 *
 * The orchestrator remains provider-agnostic; any provider-specific behavior
 * (parse modes, escaping rules, etc.) must live inside the adapter.
 */
export interface MarkdownPublisherPort {
  /**
   * Publishes a Markdown message.
   *
   * Implementations should throw on failure to publish.
   */
  publishMarkdown(input: { readonly text: string }): Promise<{ readonly externalId?: string }>;
}

