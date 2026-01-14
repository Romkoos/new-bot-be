/**
 * Port responsible for assembling a publishable digest post from digest items.
 *
 * Provider-agnostic:
 * - The orchestrator provides the semantic digest items (`string[]`).
 * - Concrete adapters format/escape/build the final post for a target surface (Telegram, email, etc.).
 */
export interface DigestPostAssemblerPort {
  /**
   * Builds the final digest post text.
   *
   * Implementations must be deterministic and safe for the target surface.
   */
  assemblePost(input: { readonly items: ReadonlyArray<string> }): string;
}

