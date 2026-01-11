import { GoogleGenAI } from "@google/genai";
import type { TextGenerationPort } from "../ports/TextGenerationPort";

/**
 * Gemini-based implementation of {@link TextGenerationPort}.
 *
 * Provider-specific details (API key, SDK, model naming) are intentionally confined to this adapter.
 */
export class GoogleGeminiTextGenerator implements TextGenerationPort {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  public constructor(params: { readonly env: NodeJS.ProcessEnv }) {
    const apiKey = params.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GoogleGeminiTextGenerator: GEMINI_API_KEY is required.");
    }

    // The model name is configurable via a provider-agnostic env var.
    // Default is chosen as a low-cost option; users may override based on availability/pricing.
    this.model = params.env.PUBLISHING_LLM_MODEL ?? "gemini-2.0-flash-lite";

    this.ai = new GoogleGenAI({ apiKey });
  }

  public async generateText(input: { readonly prompt: string }): Promise<{ readonly text: string; readonly model?: string }> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: input.prompt,
    });

    const text = response.text;
    if (typeof text !== "string") {
      throw new Error("GoogleGeminiTextGenerator: unexpected SDK response shape (missing text).");
    }

    return { text, model: this.model };
  }
}

