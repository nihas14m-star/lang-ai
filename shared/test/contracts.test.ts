import { describe, expect, it } from "vitest";
import {
  EvaluationResponseSchema, LearnerSnapshotSchema, SpeakingAnalysisResponseSchema,
  TutorTurnResponseSchema, type LearnerSnapshotT,
} from "../src/contracts";
import { SCENARIOS, INTERVIEW_SCENARIOS, scenarioById } from "../src/scenarios";

export function snapshot(over: Partial<LearnerSnapshotT> = {}): LearnerSnapshotT {
  return LearnerSnapshotSchema.parse({
    name: "Test",
    nativeLanguage: "Tamil",
    cefrLevel: "B1",
    ...over,
  });
}

describe("contracts", () => {
  it("LearnerSnapshot applies safe defaults", () => {
    const s = snapshot();
    expect(s.goals).toEqual([]);
    expect(s.activeMistakes).toEqual([]);
  });

  it("rejects invalid CEFR levels", () => {
    expect(() => snapshot({ cefrLevel: "Z1" as never })).toThrow();
  });

  it("TutorTurnResponse validates a well-formed AI reply", () => {
    const parsed = TutorTurnResponseSchema.parse({
      reply: "Good attempt!",
      ttsText: "Good attempt! Try again.",
      corrections: [{
        original: "Yesterday I go college",
        corrected: "Yesterday I went to college",
        explanation: "Past time marker needs past tense.",
        category: "tense",
        severity: "critical",
      }],
      vocabulary: [],
      meta: { provider: "mock", model: "mock-1", latencyMs: 5, degraded: false },
    });
    expect(parsed.corrections[0]!.category).toBe("tense");
  });

  it("TutorTurnResponse rejects a malformed AI reply", () => {
    expect(() => TutorTurnResponseSchema.parse({ reply: "" })).toThrow();
    expect(() =>
      TutorTurnResponseSchema.parse({
        reply: "ok", ttsText: "ok",
        corrections: [{ original: "x", corrected: "y", explanation: "z", category: "NOT_A_CATEGORY", severity: "critical" }],
      }),
    ).toThrow();
  });

  it("caps corrections and vocabulary (defense against runaway models)", () => {
    const corrections = Array.from({ length: 10 }, () => ({
      original: "a", corrected: "b", explanation: "c", category: "tense" as const, severity: "note" as const,
    }));
    expect(() => TutorTurnResponseSchema.parse({ reply: "r", ttsText: "t", corrections })).toThrow();
  });

  it("EvaluationResponse and SpeakingAnalysis validate", () => {
    const ev = EvaluationResponseSchema.parse({
      correct: true, score: 85, feedback: "Well done.",
      corrections: [], vocabulary: [], shouldRetry: false,
      skillUpdates: [{ skill: "grammar", correct: true, quality: 0.9 }],
    });
    expect(ev.skillUpdates[0]!.skill).toBe("grammar");

    const sp = SpeakingAnalysisResponseSchema.parse({
      feedback: "Steady pace.",
      corrections: [], vocabulary: [],
      measured: { wpm: 95, fillerCount: 1, fillerRate: 2.5, diversity: 0.7, avgSentenceLength: 9.5, words: 40 },
      fluency: { band: "steady", reasons: ["Reasonable pace"] },
      shouldRetry: false,
    });
    expect(sp.measured.wpm).toBe(95);
    expect(sp.pronunciationNote).toContain("not a pronunciation score");
  });

  it("scenarios are well-formed and resolvable", () => {
    for (const s of [...SCENARIOS, ...INTERVIEW_SCENARIOS]) {
      expect(s.successCriteria.length).toBeGreaterThan(0);
      expect(s.objective.length).toBeGreaterThan(0);
      expect(scenarioById(s.id)?.id).toBe(s.id);
    }
    expect(scenarioById("interview_hr")!.id).toBe("interview_hr");
    expect(scenarioById("nonexistent")).toBeUndefined();
  });

  it("scenario difficulties are valid CEFR", () => {
    for (const s of SCENARIOS) {
      expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(s.difficulty);
    }
  });
});
