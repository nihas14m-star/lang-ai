/**
 * Google Gemini provider (REST, generativelanguage API).
 * Messages are mapped to Gemini contents; system prompt -> systemInstruction.
 */

import type { AIProvider, ChatRequest, ChatResult } from "./provider";
import { fetchJson, ProviderError } from "./provider";
import type { ProviderConfig } from "../config";
import type { ChatMessage } from "./provider";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(private readonly config: ProviderConfig) {}

  get model(): string {
    return this.config.model ?? "unknown";
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    if (!this.isConfigured()) {
      throw new ProviderError("GEMINI_API_KEY is not configured", this.name, undefined, false);
    }
    const baseUrl = (this.config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    const systemParts = request.messages.filter((m) => m.role === "system");
    const contents = request.messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const started = Date.now();
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 1200,
        ...(request.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: systemParts.map((m) => ({ text: m.content })) };
    }

    const json = await fetchJson(
      `${baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey ?? "",
        },
        body: JSON.stringify(body),
      },
      request.timeoutMs ?? 30_000,
    ) as GeminiResponse;

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new ProviderError("Empty completion from Gemini", this.name, undefined, true);
    return {
      text,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount,
        outputTokens: json.usageMetadata?.candidatesTokenCount,
      },
    };
  }
}
