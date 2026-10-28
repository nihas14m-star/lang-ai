/**
 * NVIDIA NIM provider — the default AI provider.
 * OpenAI-compatible endpoint: POST {baseUrl}/chat/completions
 * Auth: Authorization: Bearer $NVIDIA_API_KEY
 * Supports streaming and tool calling; we use non-streaming chat with
 * JSON-mode when requested (best effort; prompt also demands JSON).
 */

import type { AIProvider, ChatRequest, ChatResult } from "./provider";
import { fetchJson, ProviderError } from "./provider";
import type { ProviderConfig } from "../config";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class NVIDIAProvider implements AIProvider {
  readonly name = "nvidia";

  constructor(private readonly config: ProviderConfig) {}

  get model(): string {
    return this.config.model ?? "unknown";
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    if (!this.isConfigured()) {
      throw new ProviderError("NVIDIA_API_KEY is not configured", this.name, undefined, false);
    }
    const baseUrl = (this.config.baseUrl ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
    const started = Date.now();
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1200,
      stream: false,
    };
    if (request.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    const json = await fetchJson(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      request.timeoutMs ?? 30_000,
    ) as OpenAIChatResponse;

    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new ProviderError("Empty completion from NVIDIA", this.name, undefined, true);
    }
    return {
      text,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: json.usage?.prompt_tokens,
        outputTokens: json.usage?.completion_tokens,
      },
    };
  }
}
