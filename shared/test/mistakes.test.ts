import { describe, expect, it } from "vitest";
import {
  categoryAccuracy, heuristicDetect, mergeMistake, mistakeStats, type MistakeRecord,
} from "../src/mistakes";

const NOW = 1_700_000_000_000;

function makeMistake(over: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: "tense:yesterday_i_go",
    category: "tense",
    original: "Yesterday I go college",
    corrected: "Yesterday I went to college",
    explanation: "Past time marker needs past tense.",
    context: "",
    frequency: 1,
    correctCount: 0,
    confidence: 60,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    srs: { repetitions: 0, ease: 2.5, intervalDays: 0, dueAt: NOW, lapses: 0 },
    ...over,
  };
}

describe("mistakes", () => {
  it("correction stage progresses with accuracy", () => {
    const early = mistakeStats(makeMistake({ frequency: 10, correctCount: 1 }));
    expect(early.stage).toBe("explicit");
    const mid = mistakeStats(makeMistake({ frequency: 10, correctCount: 5 }));
    expect(mid.stage).toBe("guided");
    const late = mistakeStats(makeMistake({ frequency: 10, correctCount: 8 }));
    expect(late.stage).toBe("subtle");
    const mastered = mistakeStats(makeMistake({ frequency: 10, correctCount: 10 }));
    expect(mastered.stage).toBe("mastered");
  });

  it("mergeMistake creates then increments on the same pattern", () => {
    const first = mergeMistake(undefined, {
      category: "tense", original: "Yesterday I go college", corrected: "Yesterday I went to college",
      explanation: "x", context: "",
    }, NOW);
    expect(first.frequency).toBe(1);
    const second = mergeMistake(first, {
      category: "tense", original: "yesterday I GO college", corrected: "Yesterday I went to college",
      explanation: "x", context: "",
    }, NOW + 1000);
    expect(second.frequency).toBe(2);
    expect(second.confidence).toBe(70);
    expect(second.lastSeenAt).toBe(NOW + 1000);
  });

  it("mergeMistake does not increment frequency for different patterns in same category", () => {
    const first = mergeMistake(undefined, {
      category: "tense", original: "Yesterday I go", corrected: "went", explanation: "", context: "",
    }, NOW);
    const second = mergeMistake(first, {
      category: "tense", original: "Last week she eat", corrected: "ate", explanation: "", context: "",
    }, NOW);
    expect(second.frequency).toBe(1);
  });

  it("category accuracy across mistakes", () => {
    const mistakes = [
      makeMistake({ category: "tense", frequency: 4, correctCount: 1 }),
      makeMistake({ id: "x", category: "tense", frequency: 6, correctCount: 3 }),
      makeMistake({ id: "y", category: "article", frequency: 10, correctCount: 10 }),
    ];
    expect(categoryAccuracy(mistakes, "tense")).toBeCloseTo(0.4);
    expect(categoryAccuracy(mistakes, "article")).toBe(1);
    expect(categoryAccuracy(mistakes, "spelling")).toBeNull();
  });

  it("offline heuristics catch classic errors with high precision", () => {
    const hits = heuristicDetect("Yesterday I go college and meet my friend");
    const categories = hits.map((h) => h.category);
    expect(categories).toContain("tense");
    const go = hits.find((h) => h.original.includes("go"));
    expect(go!.corrected.toLowerCase()).toContain("went");
  });

  it("heuristics catch subject-verb agreement", () => {
    const hits = heuristicDetect("He are my brother");
    expect(hits.some((h) => h.category === "subject_verb_agreement")).toBe(true);
  });

  it("heuristics catch Indian English patterns gently", () => {
    const hits = heuristicDetect("We discussed about the plan");
    expect(hits.some((h) => h.corrected === "discussed")).toBe(true);
  });

  it("clean sentences produce no false positives", () => {
    expect(heuristicDetect("Yesterday I went to college and met my friend.")).toEqual([]);
    expect(heuristicDetect("She works at a bank and he goes to school.")).toEqual([]);
  });
});
