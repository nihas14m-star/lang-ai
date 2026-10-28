import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, structuredCall } from "../src/ai/structured";
import type { AIProvider, ChatRequest, ChatResult } from "../src/ai/provider";

describe("extractJson", () => {
  it("parses clean JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in prose", () => {
    expect(extractJson('Sure! Here is the JSON: {"a": 1} hope that helps!')).toEqual({ a: 1 });
  });

  it("handles braces inside strings", () => {
    expect(extractJson('{"text": "use {curly} braces"}')).toEqual({ text: "use {curly} braces" });
  });

  it("handles escaped quotes inside strings", () => {
    expect(extractJson('{"text": "say \\"hi\\""}')).toEqual({ text: 'say "hi"' });
  });

  it("returns null for garbage", () => {
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson('{"broken": ')).toBeNull();
    expect(extractJson("")).toBeNull();
  });
});

const TestSchema = z.object({ reply: z.string(), score: z.number() });
type TestT = z.infer<typeof TestSchema>;

function fakeProvider(responses: Array<string | Error>): AIProvider & { calls: number } {
  let i = 0;
  return {
    name: "fake",
    model: "fake-1",
    calls: 0,
    isConfigured: () => true,
    async chat(_req: ChatRequest): Promise<ChatResult> {
      this.calls++;
      const r = responses[Math.min(i++, responses.length - 1)]!;
      if (r instanceof Error) throw r;
      return { text: r, provider: "fake", model: "fake-1", latencyMs: 1 };
    },
  };
}

describe("structuredCall", () => {
  it("parses valid output on first attempt", async () => {
    const provider = fakeProvider(['{"reply": "hi", "score": 50}']);
    const res = await structuredCall(provider, TestSchema, [{ role: "user", content: "go" }]);
    expect(res.data).toEqual({ reply: "hi", score: 50 });
    expect(res.attempts).toBe(1);
    expect(provider.calls).toBe(1);
  });

  it("repairs malformed JSON with one retry", async () => {
    const provider = fakeProvider([
      'oops {"reply": "hi", "score": "not-a-number"} trailing',
      '{"reply": "hi", "score": 42}',
    ]);
    const res = await structuredCall(provider, TestSchema, [{ role: "user", content: "go" }]);
    expect(res.data).toEqual({ reply: "hi", score: 42 });
    expect(res.attempts).toBe(2);
    expect(provider.calls).toBe(2);
  });

  it("returns null (never throws) when the model never complies", async () => {
    const provider = fakeProvider(["garbage", "more garbage"]);
    const res = await structuredCall(provider, TestSchema, [{ role: "user", content: "go" }]);
    expect(res.data).toBeNull();
    expect(res.attempts).toBe(2); // 1 attempt + 1 repair
  });

  it("returns null when provider throws (network down)", async () => {
    const provider = fakeProvider([new Error("network down")]);
    const res = await structuredCall(provider, TestSchema, [{ role: "user", content: "go" }]);
    expect(res.data).toBeNull();
  });

  it("validates against the schema, not just JSON.parse", async () => {
    const provider = fakeProvider(['{"reply": 123, "score": "x"}', '{"reply": "ok", "score": 1}']);
    const res = await structuredCall(provider, TestSchema, [{ role: "user", content: "go" }]);
    expect(res.data).toEqual({ reply: "ok", score: 1 });
  });
});
