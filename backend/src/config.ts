/**
 * Backend configuration from environment variables.
 * Secrets are never logged. See .env.example.
 */

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AppConfig {
  port: number;
  apiToken?: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  dictionaryApiBase: string;
  nvidia: ProviderConfig;
  openai: ProviderConfig;
  gemini: ProviderConfig;
  openrouter: ProviderConfig;
  /** Comma-separated override, e.g. "nvidia,mock". Empty = auto. */
  providerOrder: string;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: num(env.PORT, 8787),
    apiToken: env.API_TOKEN?.trim() || undefined,
    rateLimitWindowMs: num(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: num(env.RATE_LIMIT_MAX, 60),
    dictionaryApiBase: env.DICTIONARY_API_BASE || "https://api.dictionaryapi.dev/api/v2/entries/en",
    nvidia: {
      apiKey: env.NVIDIA_API_KEY?.trim() || undefined,
      baseUrl: env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1",
      model: env.NVIDIA_MODEL?.trim() || "meta/llama-3.3-70b-instruct",
    },
    openai: {
      apiKey: env.OPENAI_API_KEY?.trim() || undefined,
      baseUrl: env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY?.trim() || undefined,
      baseUrl: env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta",
      model: env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
    },
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY?.trim() || undefined,
      baseUrl: env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
      model: env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini",
    },
    providerOrder: env.AI_PROVIDER_ORDER?.trim() || "",
  };
}
