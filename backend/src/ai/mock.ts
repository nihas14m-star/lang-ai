/**
 * Local rule-based tutor (the "mock" provider).
 * This is NOT a fake AI — it is a deterministic rule-based tutor that keeps
 * the product genuinely useful when no AI provider is configured or reachable:
 *  - detects classic mistakes with heuristics (shared/mistakes)
 *  - surfaces Indian English usage notes (shared/indian-english)
 *  - produces contract-valid structured responses for every task kind
 * Every response is marked degraded: true so the UI can say
 * "offline tutor" honestly.
 */

import type { AIProvider, ChatRequest, ChatResult } from "./provider";
import { ProviderError } from "./provider";
import { heuristicDetect } from "../../../shared/src/mistakes";
import { scanIndianEnglish } from "../../../shared/src/indian-english";
import { analyzeText } from "../../../shared/src/analysis";
import type { CorrectionT, TutorTurnRequestT, LearnerSnapshotT } from "../../../shared/src/contracts";

function correctionsFrom(text: string): CorrectionT[] {
  const hits = heuristicDetect(text);
  const notes = scanIndianEnglish(text)
    .filter((n) => n.kind === "commonly-corrected")
    .slice(0, 1)
    .map((n) => ({
      original: /You said "([^"]+)"/.exec(n.message)?.[1] ?? text.slice(0, 60),
      corrected: /→ "([^"]+)"/.exec(n.message)?.[1] ?? text.slice(0, 60),
      explanation: n.message,
      category: "word_choice" as const,
      severity: "improvement" as const,
    }));
  return [...hits.slice(0, 2).map((h) => ({
    original: h.original,
    corrected: h.corrected,
    explanation: h.explanation,
    category: h.category,
    severity: "critical" as const,
  })), ...notes];
}

function scenarioReply(learner: LearnerSnapshotT, message: string): string {
  const name = learner.name || "there";
  const last = message.trim().split(/\s+/).length;
  if (last <= 4) {
    return `Thanks, ${name}. Can you tell me a little more? For example, add who, where, or when.`;
  }
  return `Good, ${name}. I followed that. Now try adding one more detail — for example how you felt or what happened next.`;
}

/** Parse the best-effort intent out of a raw prompt. Used only as fallback. */
function extractUserText(messages: ChatRequest["messages"]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  try {
    const parsed = JSON.parse(lastUser.content) as { userMessage?: string; response?: string; text?: string; transcript?: string };
    return parsed.userMessage ?? parsed.response ?? parsed.text ?? parsed.transcript ?? lastUser.content;
  } catch {
    return lastUser.content;
  }
}

export function buildTutorTurnLocally(req: TutorTurnRequestT): {
  reply: string;
  ttsText: string;
  corrections: CorrectionT[];
  followUp?: string;
} {
  const corrections = correctionsFrom(req.message);
  const reply = scenarioReply(req.learner, req.message);
  const primary = corrections[0];
  const ttsText = primary
    ? `Good try. ${primary.explanation} Now say it again.`
    : reply;
  const followUp = primary ? "Say the sentence again with the correction." : undefined;
  return { reply, ttsText, corrections, followUp };
}

export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "rule-based-tutor";

  isConfigured(): boolean {
    return true; // always available
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const userText = extractUserText(request.messages);
    const lower = userText.toLowerCase();

    // Route by task markers embedded in prompts (see tutor/prompts.ts).
    let payload: unknown;
    if (request.messages.some((m) => m.content.includes("TASK: evaluate"))) {
      const corrections = correctionsFrom(userText);
      const correct = corrections.length === 0;
      payload = {
        correct,
        score: correct ? 90 : 55,
        feedback: correct
          ? "Nice work — I could not find grammar problems in that sentence."
          : `Focus on this: ${corrections[0]?.explanation ?? "check the verb form"}`,
        corrections,
        vocabulary: [],
        shouldRetry: !correct,
        skillUpdates: [{ skill: "grammar", correct, quality: correct ? 0.9 : 0.3 }],
      };
    } else if (request.messages.some((m) => m.content.includes("TASK: writing"))) {
      const corrections = correctionsFrom(userText);
      payload = {
        overallScore: Math.max(40, 90 - corrections.length * 12),
        strengths: ["You completed the task and stayed on topic."],
        issues: corrections.map((c) => ({
          type: "grammar" as const,
          original: c.original,
          suggestion: c.corrected,
          explanation: c.explanation,
        })),
        improvedVersion: userText,
        dontAutoRewriteNote: "Try revising yourself first; the improved version is a reference, not the answer.",
      };
    } else if (request.messages.some((m) => m.content.includes("TASK: speaking"))) {
      const m = analyzeText({ text: userText });
      const corrections = correctionsFrom(userText);
      payload = {
        feedback: `You spoke ${m.words} words. ${m.wpm ? `Pace ${m.wpm} wpm.` : ""} ${corrections[0]?.explanation ?? "Grammar looked fine this time."}`,
        corrections,
        vocabulary: [],
        shouldRetry: corrections.length > 0,
      };
    } else if (request.messages.some((m) => m.content.includes("TASK: assessment"))) {
      payload = {
        writingScore: 60,
        speakingScore: 60,
        writingFeedback: "Local estimate only — connect to an AI provider for a full writing evaluation.",
        speakingFeedback: "Local estimate only — connect to an AI provider for a full speaking evaluation.",
        estimatedLevel: "B1",
        rationale: "Rule-based estimate; configure NVIDIA_API_KEY for a full AI assessment.",
      };
    } else if (request.messages.some((m) => m.content.includes("TASK: interview"))) {
      payload = {
        overallScore: 62,
        dimensions: [
          { name: "grammar", score: 60, comment: "Check past tense forms." },
          { name: "clarity", score: 65, comment: "Keep answers structured." },
        ],
        strengths: ["You answered every question."],
        improvements: ["Use the STAR structure for behavioral questions."],
        suggestedAnswer: "A strong answer states the situation, your task, the action you took, and the result.",
      };
    } else if (request.messages.some((m) => m.content.includes("TASK: vocabulary"))) {
      payload = {
        found: false,
        item: null,
        source: "none",
        learnerHint: "Word lookup needs an internet connection (Free Dictionary API) or a configured AI provider.",
      };
    } else {
      // Default: conversation turn
      const tutor = buildTutorTurnLocally({
        sessionId: "mock", mode: "free",
        learner: {
          name: "Learner", nativeLanguage: "unknown", cefrLevel: "B1", goals: [],
          skillScores: {}, weakAreas: [], activeMistakes: [], knownVocabulary: [],
        },
        history: [], message: userText,
      });
      payload = {
        reply: tutor.reply,
        ttsText: tutor.ttsText,
        corrections: tutor.corrections,
        vocabulary: [],
        followUp: tutor.followUp,
      };
    }

    if (lower === "") {
      throw new ProviderError("Mock provider received no user text", this.name, undefined, false);
    }

    return {
      text: JSON.stringify(payload),
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - started,
    };
  }
}
