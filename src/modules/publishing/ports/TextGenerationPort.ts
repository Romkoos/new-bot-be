/**
 * Port for generating text based on an input prompt.
 *
 * This is intentionally provider-agnostic. Concrete adapters may wrap LLM providers
 * (Gemini, OpenAI, local models, etc.).
 */
export interface TextGenerationPort {
  /**
   * Generates a text completion for the given prompt.
   *
   * @param input.prompt - Full prompt content to send to the model.
   * @param input.model - Provider model identifier to use for this request.
   * @returns The generated text and optional metadata (e.g. model identifier).
   */
  generateText(input: { readonly prompt: string; readonly model: string }): Promise<{ readonly text: string; readonly model?: string }>;
}

