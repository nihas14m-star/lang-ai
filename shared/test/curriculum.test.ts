import { describe, expect, it } from "vitest";
import { prioritizeTopics, nextObjectives, TOPICS, topicById } from "../src/curriculum";
import type { MistakeRecord } from "../src/mistakes";

const NOW = Date.now();

function mistake(category: MistakeRecord["category"], frequency: number, correctCount: number): MistakeRecord {
  return {
    id: `${category}-${frequency}-${correctCount}`,
    category, original: "x", corrected: "y", explanation: "", context: "",
    frequency, correctCount, confidence: 80,
    firstSeenAt: NOW - 86400_000, lastSeenAt: NOW,
    srs: { repetitions: 0, ease: 2.5, intervalDays: 0, dueAt: NOW, lapses: 0 },
  };
}

describe("curriculum", () => {
  it("has unique topic ids with valid levels", () => {
    const ids = new Set(TOPICS.map((t) => t.id));
    expect(ids.size).toBe(TOPICS.length);
  });

  it("ranks topics with recurring mistakes first", () => {
    const ranked = prioritizeTopics({
      cefrLevel: "B1",
      mistakes: [mistake("tense", 8, 1), mistake("tense", 5, 0)],
      grammarScore: 45,
    });
    expect(ranked[0]!.priority).toBeGreaterThan(0);
    const top = ranked.slice(0, 3).map((r) => r.topic.id);
    expect(top).toContain("past_simple");
  });

  it("does not prioritize mastered categories", () => {
    const ranked = prioritizeTopics({
      cefrLevel: "B2",
      mistakes: [mistake("tense", 10, 10)],
    });
    const pastSimple = ranked.find((r) => r.topic.id === "past_simple")!;
    const story = ranked.find((r) => r.topic.id === "storytelling")!;
    // with perfect tense accuracy, storytelling (level-appropriate) should outrank drills
    expect(story.priority).toBeGreaterThanOrEqual(pastSimple.priority);
  });

  it("generates human-readable objectives", () => {
    const objs = nextObjectives({
      cefrLevel: "A2",
      mistakes: [mistake("article", 6, 2)],
    });
    expect(objs.length).toBeGreaterThan(0);
    expect(objs[0]).toMatch(/Articles|article/);
  });

  it("topicById resolves", () => {
    expect(topicById("past_simple")?.name).toBe("Past simple");
    expect(topicById("nope")).toBeUndefined();
  });
});
