import { GoogleGenAI } from "@google/genai";
import type { TextGenerationPort } from "../ports/TextGenerationPort";

/**
 * Gemini-based implementation of {@link TextGenerationPort}.
 *
 * Provider-specific details (API key, SDK, model naming) are intentionally confined to this adapter.
 */
export class GoogleGeminiTextGenerator implements TextGenerationPort {
  private readonly env: NodeJS.ProcessEnv;
  private ai: GoogleGenAI | null = null;

  public constructor(params: { readonly env: NodeJS.ProcessEnv }) {
    this.env = params.env;
  }

  public async generateText(input: { readonly prompt: string; readonly model: string }): Promise<{ readonly text: string; readonly model?: string }> {
    const response = await this.getClient().models.generateContent({
      model: input.model,
      contents: input.prompt,
    });

    const text = response.text;
    if (typeof text !== "string") {
      throw new Error("GoogleGeminiTextGenerator: unexpected SDK response shape (missing text).");
    }

    return { text, model: input.model };
  }

  private getClient(): GoogleGenAI {
    if (this.ai) return this.ai;

    const apiKey = this.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GoogleGeminiTextGenerator: GEMINI_API_KEY is required.");
    }

    this.ai = new GoogleGenAI({ apiKey });
    return this.ai;
  }
}

