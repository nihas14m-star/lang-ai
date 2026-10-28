/**
 * Offline tutor fallback.
 * When the backend is unreachable, the app still corrects the classic
 * mistakes and reviews vocabulary using the shared rule engine.
 * Every response from this module is labeled "offline" in the UI.
 */

import { heuristicDetect } from "../../../shared/src/mistakes";
import { scanIndianEnglish } from "../../../shared/src/indian-english";
import type {
  CorrectionT, TutorTurnRequestT, TutorTurnResponseT, LearnerSnapshotT,
} from "../../../shared/src/contracts";
import { scenarioById } from "../../../shared/src/scenarios";

export function localTutorTurn(req: TutorTurnRequestT): TutorTurnResponseT {
  const corrections: CorrectionT[] = heuristicDetect(req.message)
    .slice(0, 2)
    .map((h) => ({
      original: h.original,
      corrected: h.corrected,
      explanation: h.explanation,
      category: h.category,
      severity: "critical" as const,
    }));

  const indianNotes = scanIndianEnglish(req.message)
    .filter((n) => n.kind === "commonly-corrected")
    .slice(0, 1)
    .map((n) => ({
      original: /You said "([^"]+)"/.exec(n.message)?.[1] ?? req.message.slice(0, 40),
      corrected: /→ "([^"]+)"/.exec(n.message)?.[1] ?? "",
      explanation: n.message,
      category: "word_choice" as const,
      severity: "note" as const,
    }));
  corrections.push(...indianNotes);

  const scenario = req.scenario ?? (req.mode === "interview" ? scenarioById("interview_hr") : undefined);
  const wordCount = req.message.trim().split(/\s+/).filter(Boolean).length;

  let reply: string;
  if (wordCount <= 3) {
    reply = "Tell me a little more — who, where, or when?";
  } else if (scenario) {
    reply = `Good. ${scenario.objective.split(".")[0] ?? "Keep going"} — what happened next?`;
  } else {
    reply = "I follow you. Add one more detail — how did it end?";
  }

  const primary = corrections[0];
  return {
    reply: primary ? `Good try! ${primary.explanation} Now say it again.` : reply,
    ttsText: primary ? `Good try. ${primary.explanation} Now say it again.` : reply,
    corrections,
    vocabulary: [],
    followUp: primary ? "Say the sentence again with the correction." : undefined,
    meta: { provider: "offline", model: "rule-based", latencyMs: 0, degraded: true },
  };
}

/** Rule-based evaluation used for drills and when the backend is down. */
export function localEvaluate(
  response: string,
  kind: string,
): { correct: boolean; score: number; feedback: string; corrections: CorrectionT[]; skillUpdates: Array<{ skill: "grammar"; correct: boolean; quality?: number }> } {
  const hits = heuristicDetect(response);
  const correct = hits.length === 0 && response.trim().split(/\s+/).length >= 3;
  return {
    correct,
    score: correct ? 85 : 55,
    feedback: correct
      ? "Looks good from the offline checks — connect to the tutor service for a full evaluation."
      : `Focus on this: ${hits[0]?.explanation ?? "try to expand your answer a little"}`,
    corrections: hits.slice(0, 2).map((h) => ({
      original: h.original, corrected: h.corrected, explanation: h.explanation,
      category: h.category, severity: "critical" as const,
    })),
    skillUpdates: [{ skill: "grammar", correct, quality: correct ? 0.85 : 0.3 }],
  };
}

export function snapshotForOffline(name: string, cefrLevel: LearnerSnapshotT["cefrLevel"]): LearnerSnapshotT {
  return {
    name, nativeLanguage: "unknown", cefrLevel, goals: [],
    skillScores: {}, weakAreas: [], activeMistakes: [], knownVocabulary: [],
  };
}
