import { describe, expect, it } from "vitest";
import { checkDrillAnswer, DRILLS, drillById, pickDrills } from "../src/exercises";
import { TOPICS } from "../src/curriculum";

describe("exercise bank", () => {
  it("every drill references a real topic and has answers", () => {
    const topicIds = new Set(TOPICS.map((t) => t.id));
    for (const d of DRILLS) {
      expect(topicIds.has(d.topicId), `drill ${d.id} topic ${d.topicId}`).toBe(true);
      expect(d.answers.length, `drill ${d.id} answers`).toBeGreaterThan(0);
      expect(d.explanation.length, `drill ${d.id} explanation`).toBeGreaterThan(5);
      if (d.type === "choose") {
        expect(d.options?.length, `drill ${d.id} options`).toBeGreaterThanOrEqual(2);
        // every answer must be one of the options (case-insensitive, trimmed)
        const normalizedOptions = d.options!.map((o) => o.toLowerCase().trim().replace(/[.!?]+$/, ""));
        for (const a of d.answers) {
          expect(normalizedOptions, `drill ${d.id} answer ${a}`).toContain(a.toLowerCase().trim().replace(/[.!?]+$/, ""));
        }
      }
    }
  });

  it("covers the main topic areas", () => {
    const covered = new Set(DRILLS.map((d) => d.topicId));
    for (const must of ["past_simple", "articles", "prepositions", "subject_verb_agreement", "present_perfect"]) {
      expect(covered.has(must), `bank must cover ${must}`).toBe(true);
    }
  });

  it("pickDrills is deterministic with a seed and filters correctly", () => {
    const a = pickDrills({ topicId: "past_simple", count: 3, seed: 42 });
    const b = pickDrills({ topicId: "past_simple", count: 3, seed: 42 });
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
    expect(a.every((d) => d.topicId === "past_simple")).toBe(true);

    const capped = pickDrills({ topicId: "past_simple", count: 100, seed: 1 });
    expect(capped.length).toBeLessThanOrEqual(DRILLS.filter((d) => d.topicId === "past_simple").length);
  });

  it("pickDrills respects level ceiling", () => {
    const easy = pickDrills({ level: "A1", count: 100, seed: 7 });
    expect(easy.every((d) => d.level === "A1")).toBe(true);
    const b1 = pickDrills({ level: "B1", count: 100, seed: 7 });
    expect(b1.every((d) => ["A1", "A2", "B1"].includes(d.level))).toBe(true);
  });

  it("checkDrillAnswer scores deterministically", () => {
    const drill = drillById("pa1")!;
    expect(checkDrillAnswer(drill, "met").correct).toBe(true);
    expect(checkDrillAnswer(drill, "Met.").correct).toBe(true);
    expect(checkDrillAnswer(drill, "meeted").correct).toBe(false);

    const fill = drillById("ar2")!;
    expect(checkDrillAnswer(fill, "an").correct).toBe(true);
    expect(checkDrillAnswer(fill, "a").correct).toBe(false);
  });
});
