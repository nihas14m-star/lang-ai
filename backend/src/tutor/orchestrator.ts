/**
 * Tutor orchestrator: builds prompts, calls the provider chain, validates
 * structured output, and degrades gracefully to the local rule-based tutor.
 * The learning engine on the device owns all learner data; the backend only
 * sees the ephemeral snapshot included in each request.
 */

import type {
  AssessmentAIResultT, AssessmentRequestT,
  EvaluationResponseT, EvaluateRequestT,
  InterviewReportResponseT, InterviewReportRequestT,
  LearnerSnapshotT, SpeakingAnalysisResponseT,
  SpeakingAnalyzeRequestT, TutorTurnResponseT,
  TutorTurnRequestT, VocabularyLookupResponseT,
  VocabularyLookupRequestT, WritingAnalysisResponseT,
  WritingAnalyzeRequestT,
} from "../../../shared/src/contracts";
import {
  AssessmentAIResultSchema, EvaluationResponseSchema, InterviewReportResponseSchema,
  SpeakingAnalysisResponseSchema, TutorTurnResponseSchema, VocabularyLookupResponseSchema,
  WritingAnalysisResponseSchema,
} from "../../../shared/src/contracts";
import { analyzeText, fluencyVerdict, wordRecognitionAgainstTarget } from "../../../shared/src/analysis";
import { AllProvidersFailedError, type AIProvider } from "../ai/provider";
import type { ChatMessage } from "../ai/provider";
import type { ProviderChain } from "../ai/registry";
import type { ZodType, ZodTypeDef } from "zod";
import { z } from "zod";
import { structuredCall, type StructuredCallOptions } from "../ai/structured";
import {
  buildTutorTurnLocally,
} from "../ai/mock";
import {
  ASSESSMENT_SYSTEM, INTERVIEW_SYSTEM, SPEAKING_SYSTEM, VOCABULARY_SYSTEM,
  WRITING_SYSTEM, evaluateSystemPrompt, tutorSystemPrompt, tutorUserPrompt,
} from "./prompts";

export type Deps = { chain: ProviderChain; dictionaryApiBase: string };

function metaFrom(result: { provider?: string; model?: string; latencyMs: number }, degraded: boolean) {
  return {
    provider: result.provider ?? "none",
    model: result.model ?? "none",
    latencyMs: Math.round(result.latencyMs),
    degraded,
  };
}

async function callStructured<S extends ZodType<unknown, ZodTypeDef, unknown>>(
  provider: AIProvider | undefined,
  schema: S,
  messages: ChatMessage[],
  options?: StructuredCallOptions,
): Promise<{ data: z.output<S> | null; meta: ReturnType<typeof metaFrom> }> {
  if (!provider) {
    return { data: null, meta: metaFrom({ latencyMs: 0 }, true) };
  }
  const res = await structuredCall(provider, schema, messages, options);
  // The rule-based mock provider is a real tutor but not full AI:
  // flag every mock-sourced response as degraded so the UI can label it honestly.
  const degraded = res.data === null || provider.name === "mock";
  console.log(JSON.stringify({
    evt: "structured_call", provider: res.provider ?? "none", attempts: res.attempts,
    ok: res.data !== null, latencyMs: res.latencyMs,
  }));
  return {
    data: res.data,
    meta: metaFrom({ provider: res.provider, model: res.model, latencyMs: res.latencyMs }, degraded),
  };
}

// ---------------- Tutor turn ----------------

export async function tutorTurn(req: TutorTurnRequestT, deps: Deps): Promise<TutorTurnResponseT> {
  const provider = deps.chain.primaryConfigured();
  const messages = [
    { role: "system" as const, content: tutorSystemPrompt(req.learner, req.scenario) },
    { role: "user" as const, content: tutorUserPrompt(req.history, req.message) },
  ];
  const { data, meta } = await callStructured(provider, TutorTurnResponseSchema, messages, {
    temperature: 0.7,
    maxTokens: 900,
  });

  if (data) return { ...data, meta };

  // Graceful degradation: local rule-based tutor, honestly labeled.
  const local = buildTutorTurnLocally(req);
  return {
    reply: local.reply,
    ttsText: local.ttsText,
    corrections: local.corrections,
    vocabulary: [],
    followUp: local.followUp,
    meta: { provider: "local-fallback", model: "rule-based-tutor", latencyMs: meta.latencyMs, degraded: true },
  };
}

// ---------------- Evaluation ----------------

export async function evaluate(req: EvaluateRequestT, deps: Deps): Promise<EvaluationResponseT> {
  const provider = deps.chain.primaryConfigured();
  const messages = [
    { role: "system" as const, content: evaluateSystemPrompt(req.learner, req.kind) },
    {
      role: "user" as const,
      content: JSON.stringify({
        kind: req.kind,
        prompt: req.prompt,
        original: req.original,
        target: req.target,
        learnerResponse: req.response,
        recentHistory: req.history.slice(-6),
      }),
    },
  ];
  const { data, meta } = await callStructured(provider, EvaluationResponseSchema, messages, {
    temperature: 0.3,
    maxTokens: 900,
  });
  if (data) return { ...data, meta };
  throw new AllProvidersFailedError([{ provider: meta.provider, message: "structured evaluation failed" }]);
}

// ---------------- Writing ----------------

export async function analyzeWriting(req: WritingAnalyzeRequestT, deps: Deps): Promise<WritingAnalysisResponseT> {
  const provider = deps.chain.primaryConfigured();
  const messages = [
    { role: "system" as const, content: WRITING_SYSTEM(req.learner) },
    {
      role: "user" as const,
      content: JSON.stringify({ taskType: req.taskType, prompt: req.prompt ?? "", text: req.text }),
    },
  ];
  const { data, meta } = await callStructured(provider, WritingAnalysisResponseSchema, messages, {
    temperature: 0.3,
    maxTokens: 1400,
  });
  if (data) return { ...data, meta };
  // Deterministic fallback: heuristic corrections + honest note.
  const { heuristicDetect } = await import("../../../shared/src/mistakes");
  const { scanIndianEnglish } = await import("../../../shared/src/indian-english");
  const hits = heuristicDetect(req.text);
  const notes = scanIndianEnglish(req.text).filter((n) => n.kind === "commonly-corrected");
  return {
    overallScore: Math.max(45, 90 - hits.length * 10),
    strengths: ["You completed the task."],
    issues: [
      ...hits.map((h) => ({
        type: "grammar" as const, original: h.original, suggestion: h.corrected, explanation: h.explanation,
      })),
      ...notes.map((n) => ({
        type: "naturalness" as const,
        original: /You said "([^"]+)"/.exec(n.message)?.[1] ?? "",
        suggestion: /→ "([^"]+)"/.exec(n.message)?.[1] ?? "",
        explanation: n.message,
      })),
    ],
    improvedVersion: req.text,
    dontAutoRewriteNote: "Offline mode: only rule-based checks ran. Connect to the tutor service for full writing analysis.",
    meta: { provider: "local-fallback", model: "rule-based", latencyMs: meta.latencyMs, degraded: true },
  };
}

// ---------------- Speaking ----------------

export async function analyzeSpeaking(req: SpeakingAnalyzeRequestT, deps: Deps): Promise<SpeakingAnalysisResponseT> {
  const m = analyzeText({
    text: req.transcript,
    durationSec: req.metrics.durationSec,
    longestPauseSec: req.metrics.longestPauseSec,
  });
  const fv = fluencyVerdict(m);
  const wordRecognition = req.targetSentence
    ? wordRecognitionAgainstTarget(req.targetSentence, req.transcript)
    : undefined;

  const provider = deps.chain.primaryConfigured();
  const isMock = provider?.name === "mock";
  const messages = [
    { role: "system" as const, content: SPEAKING_SYSTEM(req.learner) },
    {
      role: "user" as const,
      content: JSON.stringify({
        prompt: req.prompt ?? "",
        transcript: req.transcript,
        measured: {
          wpm: m.wpm, fillerCount: m.fillerCount, fillerRate: m.fillerRate,
          diversity: m.diversity, avgSentenceLength: m.avgSentenceLength, words: m.words,
        },
        fluency: fv,
        targetSentence: req.targetSentence,
      }),
    },
  ];
  const { data, meta } = await callStructured(provider, SpeakingAnalysisResponseSchema, messages, {
    temperature: 0.4,
    maxTokens: 800,
  });

  const measured = {
    wpm: m.wpm, fillerCount: m.fillerCount, fillerRate: m.fillerRate,
    diversity: m.diversity, avgSentenceLength: m.avgSentenceLength, words: m.words,
  };
  const base = {
    measured,
    fluency: { band: fv.band, reasons: fv.reasons.slice(0, 6) },
    wordRecognition,
    pronunciationNote: wordRecognition
      ? "Highlighted words were not recognized by speech recognition. This is a hint to try again clearly — it is NOT a pronunciation score. Phoneme-level analysis is not available in this build."
      : "Pronunciation scoring requires a dedicated pronunciation service and is not available in this build.",
  };

  if (data) return { ...data, ...base, meta };
  return {
    ...base,
    feedback: `You said ${m.words} word(s). ${fv.reasons[0] ?? ""} ${isMock ? "Connect to an AI provider for deeper speaking feedback." : ""}`.trim(),
    corrections: [],
    vocabulary: [],
    shouldRetry: false,
    meta: { provider: "local-fallback", model: "rule-based", latencyMs: meta.latencyMs, degraded: true },
  };
}

// ---------------- Assessment (open sections) ----------------

export async function assessOpen(
  req: AssessmentRequestT,
  deps: Deps,
): Promise<{ ai: AssessmentAIResultT | null; meta: ReturnType<typeof metaFrom> }> {
  const provider = deps.chain.primaryConfigured();
  if (req.responses.length === 0) {
    return { ai: null, meta: metaFrom({ latencyMs: 0 }, true) };
  }
  const messages = [
    { role: "system" as const, content: ASSESSMENT_SYSTEM(req.learner) },
    { role: "user" as const, content: JSON.stringify({ openResponses: req.responses }) },
  ];
  const { data, meta } = await callStructured(provider, AssessmentAIResultSchema, messages, {
    temperature: 0.2,
    maxTokens: 700,
  });
  return { ai: data, meta };
}

// ---------------- Interview report ----------------

export async function interviewReport(
  req: InterviewReportRequestT,
  deps: Deps,
): Promise<InterviewReportResponseT> {
  const provider = deps.chain.primaryConfigured();
  const messages = [
    { role: "system" as const, content: INTERVIEW_SYSTEM(req.learner) },
    {
      role: "user" as const,
      content: JSON.stringify({
        scenario: req.scenario,
        transcript: req.turns.map((t) => `${t.role === "user" ? "Candidate" : "Interviewer"}: ${t.content}`),
      }),
    },
  ];
  const { data, meta } = await callStructured(provider, InterviewReportResponseSchema, messages, {
    temperature: 0.3,
    maxTokens: 1200,
  });
  if (data) return { ...data, meta };
  return {
    overallScore: 0,
    dimensions: [],
    strengths: [],
    improvements: [],
    suggestedAnswer: "",
    meta: { provider: "local-fallback", model: "rule-based", latencyMs: meta.latencyMs, degraded: true },
  };
}

// ---------------- Vocabulary ----------------

interface DictionaryEntry {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
    synonyms?: string[];
  }>;
}

export async function lookupVocabulary(
  req: VocabularyLookupRequestT,
  deps: Deps,
): Promise<VocabularyLookupResponseT> {
  const started = Date.now();
  const word = req.word.trim().toLowerCase();

  // 1. Free Dictionary API (real public API, no key, cached in-memory).
  const cached = vocabCache.get(word);
  if (cached) {
    return { ...cached, source: "cache", meta: { provider: "cache", latencyMs: Date.now() - started } };
  }
  try {
    const res = await fetch(`${deps.dictionaryApiBase}/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const entries = (await res.json()) as DictionaryEntry[];
      const entry = Array.isArray(entries) ? entries[0] : undefined;
      const meaning = entry?.meanings?.[0];
      const def = meaning?.definitions?.[0];
      if (entry?.word && def?.definition) {
        const response: VocabularyLookupResponseT = {
          found: true,
          item: {
            word: entry.word,
            meaning: def.definition,
            partOfSpeech: meaning?.partOfSpeech,
            pronunciation: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
            example: def.example,
            synonyms: meaning?.synonyms?.slice(0, 5),
            difficulty: guessDifficulty(word),
          },
          source: "dictionary-api",
          meta: { provider: "dictionary-api", latencyMs: Date.now() - started },
        };
        vocabCache.set(word, response);
        if (vocabCache.size > 500) vocabCache.delete(vocabCache.keys().next().value as string);
        return response;
      }
    }
  } catch {
    // fall through to AI
  }

  // 2. AI provider as backup (also humanizes meaning for the learner's level).
  const provider = deps.chain.primaryConfigured();
  const messages = [
    { role: "system" as const, content: VOCABULARY_SYSTEM(req.learner) },
    {
      role: "user" as const,
      content: JSON.stringify({ word, context: req.context ?? "" }),
    },
  ];
  const { data, meta } = await callStructured(provider, VocabularyLookupResponseSchema, messages, {
    temperature: 0.3,
    maxTokens: 500,
  });
  if (data?.found && data.item) {
    return { ...data, source: "ai", meta: { provider: data.meta?.provider ?? meta.provider, latencyMs: meta.latencyMs } };
  }
  return {
    found: false,
    item: null,
    source: "none",
    learnerHint: "Couldn't find that word right now. Check the spelling, or try again when connected.",
    meta: { provider: "dictionary-api", latencyMs: Date.now() - started },
  };
}

const vocabCache = new Map<string, VocabularyLookupResponseT>();

/** Rough frequency-band heuristic — honest coarse guess, refined by AI when available. */
function guessDifficulty(word: string): "A1" | "A2" | "B1" | "B2" | "C1" | "C2" {
  const len = word.length;
  if (len <= 4) return "A1";
  if (len <= 6) return "A2";
  if (len <= 8) return "B1";
  if (len <= 10) return "B2";
  return "C1";
}

export function learnerNameOr(learner: LearnerSnapshotT): string {
  return learner.name?.trim() || "Learner";
}
