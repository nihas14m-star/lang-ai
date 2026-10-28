import { describe, expect, it, vi, afterEach } from "vitest";
import { NVIDIAProvider } from "../src/ai/nvidia";
import { GeminiProvider } from "../src/ai/gemini";
import { MockProvider } from "../src/ai/mock";
import { buildProviderChain } from "../src/ai/registry";
import { AllProvidersFailedError, ProviderError } from "../src/ai/provider";
import { loadConfig } from "../src/config";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NVIDIA provider", () => {
  const baseEnv = {
    NVIDIA_API_KEY: "nvapi-test-key",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    NVIDIA_MODEL: "meta/llama-3.3-70b-instruct",
  };

  it("sends bearer auth and parses an OpenAI-compatible response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: "Hello!" } }], usage: { prompt_tokens: 10, completion_tokens: 3 } }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NVIDIAProvider({
      apiKey: baseEnv.NVIDIA_API_KEY, baseUrl: baseEnv.NVIDIA_BASE_URL, model: baseEnv.NVIDIA_MODEL,
    });
    const result = await provider.chat({ messages: [{ role: "user", content: "hi" }] });

    expect(result.text).toBe("Hello!");
    expect(result.provider).toBe("nvidia");
    expect(result.usage?.inputTokens).toBe(10);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer nvapi-test-key");
  });

  it("requests JSON mode when asked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new NVIDIAProvider({
      apiKey: "k", baseUrl: "https://integrate.api.nvidia.com/v1", model: "m",
    });
    await provider.chat({ messages: [{ role: "user", content: "hi" }], jsonMode: true });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws a retryable error on 429/5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const provider = new NVIDIAProvider({ apiKey: "k", baseUrl: "https://x/v1", model: "m" });
    await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({
      retryable: true, status: 429,
    });
  });

  it("aborts on timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    ));
    const provider = new NVIDIAProvider({ apiKey: "k", baseUrl: "https://x/v1", model: "m" });
    await expect(provider.chat({ messages: [{ role: "user", content: "hi" }], timeoutMs: 30 }))
      .rejects.toBeInstanceOf(ProviderError);
  });

  it("is unconfigured without a key", () => {
    const provider = new NVIDIAProvider({ baseUrl: "https://x/v1", model: "m" });
    expect(provider.isConfigured()).toBe(false);
  });
});

describe("Gemini provider", () => {
  it("maps messages and parses Gemini responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hi from Gemini" }] } }] }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider({ apiKey: "g-key", model: "gemini-2.0-flash" });
    const result = await provider.chat({
      messages: [
        { role: "system", content: "be nice" },
        { role: "user", content: "hello" },
      ],
    });
    expect(result.text).toBe("Hi from Gemini");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.0-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("be nice");
    expect(body.contents[0].role).toBe("user");
  });
});

describe("Mock provider (offline rule-based tutor)", () => {
  it("produces valid tutor-turn JSON", async () => {
    const provider = new MockProvider();
    const result = await provider.chat({
      messages: [{ role: "user", content: 'Learner\'s new message: "Yesterday I go college"' }],
    });
    const parsed = JSON.parse(result.text) as Record<string, unknown>;
    expect(parsed.reply).toBeTruthy();
    expect(Array.isArray(parsed.corrections)).toBe(true);
    expect(result.provider).toBe("mock");
  });

  it("produces valid evaluation JSON", async () => {
    const provider = new MockProvider();
    const result = await provider.chat({
      messages: [{ role: "user", content: "TASK: evaluate\n{\"learnerResponse\": \"He don't like tea\"}" }],
    });
    const parsed = JSON.parse(result.text) as { correct: boolean; score: number };
    expect(parsed.correct).toBe(false);
    expect(parsed.score).toBeLessThan(80);
  });

  it("always reports itself as available", () => {
    expect(new MockProvider().isConfigured()).toBe(true);
  });
});

describe("provider chain", () => {
  it("nvidia is the default when configured", () => {
    const chain = buildProviderChain(loadConfig({ NVIDIA_API_KEY: "k" } as NodeJS.ProcessEnv));
    expect(chain.defaultProvider).toBe("nvidia");
  });

  it("falls back to mock when no keys are configured", () => {
    const chain = buildProviderChain(loadConfig({} as NodeJS.ProcessEnv));
    expect(chain.defaultProvider).toBe("mock");
    expect(chain.primaryConfigured()?.name).toBe("mock");
  });

  it("skips failing providers and uses the next configured one", async () => {
    const config = loadConfig({
      NVIDIA_API_KEY: "k",
      OPENAI_API_KEY: "o",
    } as unknown as NodeJS.ProcessEnv);
    const chain = buildProviderChain(config);
    // Make nvidia fail (network), openai succeed.
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [{ message: { content: "from openai" } }] }),
        { status: 200 },
      )));
    const result = await chain.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(result.provider).toBe("openai");
  });

  it("degrades to the mock provider when AI providers fail (never fully fails)", async () => {
    const config = loadConfig({ NVIDIA_API_KEY: "k" } as unknown as NodeJS.ProcessEnv);
    const chain = buildProviderChain(config);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const result = await chain.chat({
      messages: [{ role: "user", content: 'Learner\'s new message: "hello there"' }],
    });
    expect(result.provider).toBe("mock");
  });

  it("throws AllProvidersFailedError when even the mock fails (no usable input)", async () => {
    const config = loadConfig({
      NVIDIA_API_KEY: "k", AI_PROVIDER_ORDER: "nvidia",
    } as unknown as NodeJS.ProcessEnv);
    const chain = buildProviderChain(config);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(chain.chat({ messages: [] })).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("respects explicit provider order", () => {
    const chain = buildProviderChain(loadConfig({
      NVIDIA_API_KEY: "k", OPENAI_API_KEY: "o", AI_PROVIDER_ORDER: "openai,nvidia",
    } as unknown as NodeJS.ProcessEnv));
    expect(chain.defaultProvider).toBe("openai");
  });
});
