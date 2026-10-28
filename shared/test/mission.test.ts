import { describe, expect, it } from "vitest";
import { generateDailyMission, type MissionInput } from "../src/mission";
import type { MistakeRecord } from "../src/mistakes";

const NOW = new Date("2026-10-29T10:00:00").getTime();

function m(cat: MistakeRecord["category"], due: boolean): MistakeRecord {
  return {
    id: `${cat}-${due}`,
    category: cat, original: "x", corrected: "y", explanation: "", context: "",
    frequency: 3, correctCount: 1, confidence: 70,
    firstSeenAt: NOW, lastSeenAt: NOW,
    srs: { repetitions: 1, ease: 2.5, intervalDays: 1, dueAt: due ? NOW - 1000 : NOW + 86400_000, lapses: 0 },
  };
}

const BASE: MissionInput = {
  cefrLevel: "B1",
  dailyGoalMinutes: 20,
  dueVocabCount: 6,
  dueMistakes: [m("tense", true)],
  mistakes: [m("tense", true), m("article", false)],
  scenarioIds: ["introductions", "casual_smalltalk", "ordering_food"],
  now: NOW,
  dateKey: "2026-10-29",
};

describe("daily mission", () => {
  it("builds a plan within the daily goal budget", () => {
    const mission = generateDailyMission(BASE);
    expect(mission.activities.length).toBeGreaterThanOrEqual(3);
    expect(mission.totalMinutes).toBeLessThanOrEqual(20);
    expect(mission.dateKey).toBe("2026-10-29");
  });

  it("always schedules due reviews first", () => {
    const mission = generateDailyMission(BASE);
    expect(mission.activities[0]!.kind).toBe("vocabulary_review");
    expect(mission.activities[1]!.kind).toBe("mistake_review");
  });

  it("adapts to the weakest topic", () => {
    const input: MissionInput = {
      ...BASE,
      mistakes: [m("article", true), m("article", true), m("tense", false)],
      dueVocabCount: 0,
      dueMistakes: [],
    };
    const mission = generateDailyMission(input);
    const grammar = mission.activities.find((a) => a.kind === "grammar_drill");
    expect(grammar).toBeDefined();
    expect(grammar!.title).toMatch(/Articles/i);
  });

  it("rotates conversation/speaking by date (variety)", () => {
    const day1 = generateDailyMission({ ...BASE, dateKey: "2026-10-29" });
    const day2 = generateDailyMission({ ...BASE, dateKey: "2026-10-30" });
    const kinds1 = day1.activities.map((a) => a.kind);
    const kinds2 = day2.activities.map((a) => a.kind);
    expect(kinds1.join()).not.toBe(kinds2.join());
  });

  it("with no data still produces a minimal useful plan", () => {
    const mission = generateDailyMission({
      ...BASE, dueVocabCount: 0, dueMistakes: [], mistakes: [],
    });
    expect(mission.activities.length).toBeGreaterThanOrEqual(2);
    expect(mission.activities.some((a) => a.kind === "grammar_drill" || a.kind === "conversation")).toBe(true);
  });

  it("respects a small daily goal", () => {
    const mission = generateDailyMission({ ...BASE, dailyGoalMinutes: 10 });
    expect(mission.totalMinutes).toBeLessThanOrEqual(10);
  });
});
