/**
 * Provider registry + fallback chain.
 * Priority (when auto): nvidia -> openrouter -> openai -> gemini -> mock.
 * The mock (rule-based) provider is always last so the API degrades to a
 * functional local tutor instead of failing.
 */

import type { AppConfig } from "../config";
import type { AIProvider, ChatRequest, ChatResult } from "./provider";
import { AllProvidersFailedError } from "./provider";
import { NVIDIAProvider } from "./nvidia";
import { OpenAIProvider, OpenRouterProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";

export function buildProviders(config: AppConfig): AIProvider[] {
  const list: AIProvider[] = [
    new NVIDIAProvider(config.nvidia),
    new OpenRouterProvider(config.openrouter),
    new OpenAIProvider(config.openai),
    new GeminiProvider(config.gemini),
    new MockProvider(),
  ];
  if (config.providerOrder) {
    const order = config.providerOrder.split(",").map((s) => s.trim().toLowerCase());
    const byName = new Map(list.map((p) => [p.name, p] as const));
    const ordered = order
      .map((n) => byName.get(n))
      .filter((p): p is AIProvider => Boolean(p));
    for (const p of list) {
      if (!ordered.includes(p)) ordered.push(p);
    }
    return ordered;
  }
  return list;
}

export interface ProviderChain {
  providers: AIProvider[];
  defaultProvider: string;
  /** Try configured providers in order; throw AllProvidersFailedError if all fail. */
  chat(request: ChatRequest): Promise<ChatResult>;
  /** First configured provider (for single-shot structured calls). */
  primaryConfigured(): AIProvider | undefined;
}

export function buildProviderChain(config: AppConfig): ProviderChain {
  const providers = buildProviders(config);
  const configured = providers.filter((p) => p.isConfigured());
  return {
    providers,
    defaultProvider: configured[0]?.name ?? "mock",
    async chat(request: ChatRequest): Promise<ChatResult> {
      const failures: Array<{ provider: string; message: string }> = [];
      for (const p of configured) {
        try {
          const result = await p.chat(request);
          // Structured single-line telemetry: no learner content, no secrets.
          console.log(JSON.stringify({
            evt: "ai_call", provider: result.provider, model: result.model,
            latencyMs: result.latencyMs, ok: true,
          }));
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown error";
          failures.push({ provider: p.name, message });
          console.log(JSON.stringify({ evt: "ai_call", provider: p.name, ok: false, error: message.slice(0, 200) }));
        }
      }
      throw new AllProvidersFailedError(failures);
    },
    primaryConfigured() {
      return configured[0];
    },
  };
}
