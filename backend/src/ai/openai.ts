/**
 * OpenAI-compatible provider used for OpenAI and OpenRouter.
 * (Both expose POST {baseUrl}/chat/completions with a Bearer token.)
 */

import type { AIProvider, ChatRequest, ChatResult } from "./provider";
import { fetchJson, ProviderError } from "./provider";
import type { ProviderConfig } from "../config";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    readonly name: string,
    private readonly config: ProviderConfig,
  ) {}

  get model(): string {
    return this.config.model ?? "unknown";
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    if (!this.isConfigured()) {
      throw new ProviderError(`${this.name} API key is not configured`, this.name, undefined, false);
    }
    const baseUrl = (this.config.baseUrl ?? "").replace(/\/$/, "");
    const started = Date.now();
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1200,
      stream: false,
    };
    if (request.jsonMode) body.response_format = { type: "json_object" };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.name === "openrouter") {
      headers["HTTP-Referer"] = "https://english-tutor-ai.local";
      headers["X-Title"] = "English Tutor AI";
    }

    const json = await fetchJson(
      `${baseUrl}/chat/completions`,
      { method: "POST", headers, body: JSON.stringify(body) },
      request.timeoutMs ?? 30_000,
    ) as OpenAIChatResponse;

    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) throw new ProviderError(`Empty completion from ${this.name}`, this.name, undefined, true);
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

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super("openai", config);
  }
}

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super("openrouter", config);
  }
}
