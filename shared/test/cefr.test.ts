import { describe, expect, it } from "vitest";
import {
  CEFR_LEVELS, estimateOverall, levelDistance, nextLevel, previousLevel,
  scoreToLevel, clampLevel, type SkillScores,
} from "../src/cefr";

describe("CEFR mapping", () => {
  it("maps scores to expected levels", () => {
    expect(scoreToLevel(0)).toBe("A1");
    expect(scoreToLevel(34)).toBe("A1");
    expect(scoreToLevel(35)).toBe("A2");
    expect(scoreToLevel(55)).toBe("B1");
    expect(scoreToLevel(70)).toBe("B2");
    expect(scoreToLevel(85)).toBe("C1");
    expect(scoreToLevel(95)).toBe("C2");
    expect(scoreToLevel(150)).toBe("C2");
    expect(scoreToLevel(-5)).toBe("A1");
  });

  it("orders levels and steps correctly", () => {
    expect(CEFR_LEVELS[0]).toBe("A1");
    expect(nextLevel("B1")).toBe("B2");
    expect(nextLevel("C2")).toBeNull();
    expect(previousLevel("B1")).toBe("A2");
    expect(previousLevel("A1")).toBeNull();
    expect(levelDistance("B2", "A1")).toBe(3);
    expect(levelDistance("A1", "B2")).toBe(-3);
  });

  it("clamps invalid levels", () => {
    expect(clampLevel("Z9" as never)).toBe("A1");
    expect(clampLevel("C1")).toBe("C1");
  });

  it("combines weighted skill scores into an overall estimate", () => {
    const scores: SkillScores = { grammar: 80, vocabulary: 80, speaking: 80, listening: 80, writing: 80, fluency: 80 };
    const est = estimateOverall(scores)!;
    // Conservative: unmeasured skills (pronunciation, reading) count as missing, not perfect.
    expect(est.level).toBe("B2");
    expect(est.confidence).toBe("high");
    expect(est.skillsMeasured.length).toBe(6);
  });

  it("never invents levels without data", () => {
    expect(estimateOverall({})).toBeNull();
  });

  it("reports low confidence with sparse data", () => {
    const est = estimateOverall({ grammar: 90 })!;
    expect(est.confidence).toBe("low");
  });

  it("respects pronunciation's small weight", () => {
    const onlyPron = estimateOverall({ pronunciation: 100 })!;
    expect(onlyPron.confidence).toBe("low");
  });
});
