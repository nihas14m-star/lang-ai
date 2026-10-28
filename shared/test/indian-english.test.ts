import { describe, expect, it } from "vitest";
import { scanIndianEnglish } from "../src/indian-english";

describe("Indian English awareness", () => {
  it("flags variants respectfully, not as errors", () => {
    const notes = scanIndianEnglish("Please do the needful and prepone the meeting");
    expect(notes.length).toBe(2);
    expect(notes.every((n) => n.kind === "variant")).toBe(true);
    expect(notes[0]!.message).toContain("natural Indian English");
  });

  it("explains the risky ones (pass out = faint internationally)", () => {
    const notes = scanIndianEnglish("I passed out in 2023");
    expect(notes.some((n) => n.id === "passout")).toBe(true);
  });

  it("clean international English produces no notes", () => {
    expect(scanIndianEnglish("I graduated in 2023 and moved to Pune.")).toEqual([]);
  });

  it("covers common patterns", () => {
    for (const text of [
      "I am out of station",
      "Kindly revert back",
      "Today morning I went",
      "5 years back",
      "What is your good name?",
      "He lives there only",
    ]) {
      expect(scanIndianEnglish(text).length).toBeGreaterThanOrEqual(1);
    }
  });
});
