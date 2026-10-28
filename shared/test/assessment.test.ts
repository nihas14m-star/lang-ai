import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_ITEMS, buildDiagnosticResult, itemById, scoreObjectiveResponses,
  type AssessmentResponse,
} from "../src/assessment";

const ALL = (answers: Record<string, string>): AssessmentResponse[] =>
  Object.entries(answers).map(([itemId, answer]) => ({ itemId, answer }));

describe("diagnostic assessment", () => {
  it("item bank is well-formed", () => {
    const ids = new Set(ASSESSMENT_ITEMS.map((i) => i.id));
    expect(ids.size).toBe(ASSESSMENT_ITEMS.length);
    for (const item of ASSESSMENT_ITEMS) {
      if (item.type === "choose") {
        expect(item.options?.length).toBeGreaterThanOrEqual(2);
        expect(item.answers?.length).toBeGreaterThan(0);
      }
      if (item.type === "dictation") {
        expect(item.speakText).toBeTruthy();
      }
    }
    // sections present
    const sections = new Set(ASSESSMENT_ITEMS.map((i) => i.section));
    for (const s of ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]) {
      expect(sections.has(s as never), `section ${s}`).toBe(true);
    }
  });

  it("scores a strong learner with a high estimate", () => {
    const responses = ALL({
      g1: "is", g2: "are", g3: "was watching", g4: "went", g5: "has worked", g6: "had",
      g7: "had been finished", g8: "Rarely have I seen such dedication",
      v1: "expensive", v2: "pharmacy", v3: "move to a later time", v4: "student",
      v5: "unwilling", v6: "make", v7: "very careful", v8: "not decisive",
      l1: "I usually wake up at six in the morning.",
      l2: "She has been working here for three years.",
      l3: "Although the traffic was heavy, we reached the office on time.",
      l4: "The committee is likely to reconsider its decision next week.",
      r1: "He didn't want to miss his flight", r2: "They stayed the same", r3: "made things worse",
    });
    const { sectionScores, perItem } = scoreObjectiveResponses(responses);
    const result = buildDiagnosticResult(sectionScores, { writing: 80, speaking: 75 });
    expect(result.overall!.level).toMatch(/B2|C1/);
    expect(result.sections.find((s) => s.section === "grammar")!.score).toBeGreaterThan(80);
    // every objective item scored (8 grammar + 8 vocab + 4 listening + 3 reading)
    expect(perItem.length).toBe(23);
    expect(result.disclaimer).toContain("not an official");
  });

  it("scores a beginner with a low estimate", () => {
    const responses = ALL({ g1: "are", g2: "is", v1: "small", l1: "I wake up" });
    const { sectionScores } = scoreObjectiveResponses(responses);
    const result = buildDiagnosticResult(sectionScores);
    expect(result.overall!.level).toBe("A1");
    expect(result.overall!.confidence).toBe("low"); // few skills measured
  });

  it("never fabricates open-section scores when offline", () => {
    const responses = ALL({ g1: "is", g2: "are" });
    const { sectionScores } = scoreObjectiveResponses(responses);
    const result = buildDiagnosticResult(sectionScores);
    expect(result.sections.find((s) => s.section === "writing")).toBeUndefined();
    expect(result.skillScores.speaking).toBeUndefined();
  });

  it("dictation scoring rewards partial overlap", () => {
    const full = ALL({ l1: "I usually wake up at six in the morning." });
    const partial = ALL({ l1: "I wake up at six" });
    const fullScore = scoreObjectiveResponses(full).sectionScores.get("listening")!.score;
    const partialScore = scoreObjectiveResponses(partial).sectionScores.get("listening")!.score;
    expect(fullScore).toBe(100);
    expect(partialScore).toBeGreaterThan(40);
    expect(partialScore).toBeLessThan(100);
  });

  it("itemById resolves", () => {
    expect(itemById("g5")?.level).toBe("B1");
    expect(itemById("zzz")).toBeUndefined();
  });
});
