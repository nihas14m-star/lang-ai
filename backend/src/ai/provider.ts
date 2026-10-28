/**
 * AI provider abstraction.
 * The learning engine and tutor orchestrator never depend on a specific vendor.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for JSON-formatted output (best effort across vendors). */
  jsonMode?: boolean;
  /** Abort the call after this many ms. */
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    readonly failures: Array<{ provider: string; message: string }>,
  ) {
    super(`All providers failed: ${failures.map((f) => f.provider).join(", ")}`);
    this.name = "AllProvidersFailedError";
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

/** fetch with timeout via AbortController; returns parsed JSON. */
export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderError(
        `HTTP ${res.status}: ${body.slice(0, 200)}`,
        "http",
        res.status,
        retryable,
      );
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new ProviderError("Non-JSON response body", "http", res.status, false);
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError(`Request timed out after ${timeoutMs}ms`, "http", undefined, true);
    }
    throw new ProviderError(err instanceof Error ? err.message : "Network error", "http", undefined, true);
  } finally {
    clearTimeout(timer);
  }
}
