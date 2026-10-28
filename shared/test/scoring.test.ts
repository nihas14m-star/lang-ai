import { describe, expect, it } from "vitest";
import {
  MASTERY_THRESHOLD, progressToNextLevel, strengths, updateSkillScore, weakAreas,
} from "../src/scoring";
import type { SkillScores } from "../src/cefr";

describe("skill scoring", () => {
  it("initializes a score from the first observation scaled by correctness", () => {
    const s = updateSkillScore({}, { skill: "grammar", correct: true, difficulty: "A2" });
    expect(s.grammar).toBeGreaterThan(60);
    const fail = updateSkillScore({}, { skill: "grammar", correct: false, difficulty: "A2" });
    expect(fail.grammar).toBeLessThan(30);
  });

  it("converges toward repeated results (EMA)", () => {
    let scores: SkillScores = {};
    for (let i = 0; i < 20; i++) {
      scores = updateSkillScore(scores, { skill: "grammar", correct: true, difficulty: "B2" });
    }
    expect(scores.grammar!).toBeGreaterThan(80);
    expect(scores.grammar!).toBeLessThanOrEqual(100);
  });

  it("drops after repeated failures", () => {
    let scores: SkillScores = { grammar: 70 };
    for (let i = 0; i < 10; i++) {
      scores = updateSkillScore(scores, { skill: "grammar", correct: false, difficulty: "A2" });
    }
    expect(scores.grammar!).toBeLessThan(35);
  });

  it("never leaves the 0-100 range", () => {
    let scores: SkillScores = { grammar: 99 };
    for (let i = 0; i < 30; i++) {
      scores = updateSkillScore(scores, { skill: "grammar", correct: true, difficulty: "C2", quality: 1 });
      expect(scores.grammar!).toBeLessThanOrEqual(100);
    }
    scores = { grammar: 1 };
    for (let i = 0; i < 30; i++) {
      scores = updateSkillScore(scores, { skill: "grammar", correct: false, difficulty: "A1", quality: 0 });
      expect(scores.grammar!).toBeGreaterThanOrEqual(0);
    }
  });

  it("classifies strengths and weak areas from thresholds", () => {
    const scores: SkillScores = { grammar: MASTERY_THRESHOLD + 10, vocabulary: 40, speaking: 80 };
    expect(strengths(scores)).toContain("grammar");
    expect(strengths(scores)).toContain("speaking");
    expect(weakAreas(scores)).toEqual(["vocabulary"]);
  });

  it("computes progress to next level", () => {
    const p = progressToNextLevel({ grammar: 40, vocabulary: 40, speaking: 40 }, "A2");
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(0.5);
  });
});
