/**
 * Structured output pipeline:
 *   provider text -> JSON extraction (fence-stripping, brace matching)
 *   -> zod validation -> one repair round-trip -> graceful null.
 * Malformed model output NEVER crashes the API.
 */

import type { ZodType, ZodTypeDef } from "zod";
import { z } from "zod";
import type { AIProvider, ChatMessage } from "./provider";

/** Extract the first balanced JSON object/array from arbitrary text. */
export function extractJson(text: string): unknown | null {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const open = cleaned[start]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export interface StructuredResult<T> {
  data: T | null;
  attempts: number;
  provider?: string;
  model?: string;
  latencyMs: number;
}

export interface StructuredCallOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Max repair round-trips after the first attempt (default 1). */
  maxRepairs?: number;
}

/**
 * Call a provider, parse and validate JSON.
 * Returns data=null (never throws) when the model cannot produce valid output.
 */
export async function structuredCall<S extends ZodType<unknown, ZodTypeDef, unknown>>(
  provider: AIProvider,
  schema: S,
  messages: ChatMessage[],
  options: StructuredCallOptions = {},
): Promise<StructuredResult<z.output<S>>> {
  const maxRepairs = options.maxRepairs ?? 1;
  const convo: ChatMessage[] = [...messages];
  const started = Date.now();
  let attempts = 0;
  let lastMeta: { provider?: string; model?: string } = {};

  for (let i = 0; i <= maxRepairs; i++) {
    attempts++;
    let text = "";
    try {
      const result = await provider.chat({
        messages: convo,
        jsonMode: true,
        temperature: options.temperature ?? 0.4,
        maxTokens: options.maxTokens ?? 1200,
        timeoutMs: options.timeoutMs,
      });
      text = result.text;
      lastMeta = { provider: result.provider, model: result.model };
    } catch {
      return { data: null, attempts, latencyMs: Date.now() - started, ...lastMeta };
    }

    const json = extractJson(text);
    if (json !== null) {
      const parsed = schema.safeParse(json);
      if (parsed.success) {
        return { data: parsed.data as z.output<S>, attempts, latencyMs: Date.now() - started, ...lastMeta };
      }
      convo.push({ role: "assistant", content: text.slice(0, 2000) });
      convo.push({
        role: "user",
        content: `Your JSON was invalid: ${parsed.error.issues
          .slice(0, 4)
          .map((iss) => `${iss.path.join(".") || "(root)"}: ${iss.message}`)
          .join("; ")}. Return ONLY the corrected JSON object. No prose, no markdown.`,
      });
      continue;
    }
    convo.push({ role: "assistant", content: text.slice(0, 2000) });
    convo.push({
      role: "user",
      content: "That was not valid JSON. Return ONLY the JSON object matching the requested schema. No prose, no markdown fences.",
    });
  }
  return { data: null, attempts, latencyMs: Date.now() - started, ...lastMeta };
}
