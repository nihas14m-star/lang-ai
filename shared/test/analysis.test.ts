import { describe, expect, it } from "vitest";
import { analyzeText, fluencyVerdict, wordRecognitionAgainstTarget } from "../src/analysis";

describe("text analysis", () => {
  it("counts words, sentences, and diversity", () => {
    const m = analyzeText({ text: "I went to college. I met my friend. We ate lunch together." });
    expect(m.words).toBe(12);
    expect(m.sentences).toBe(3);
    expect(m.diversity).toBeGreaterThan(0.8);
  });

  it("computes honest WPM only when duration is given", () => {
    const withTime = analyzeText({ text: "one two three four five six", durationSec: 6 });
    expect(withTime.wpm).toBe(60);
    const noTime = analyzeText({ text: "hello world" });
    expect(noTime.wpm).toBeNull();
  });

  it("detects filler words", () => {
    const m = analyzeText({ text: "I um went to the like store and basically bought apples" });
    expect(m.fillerCount).toBeGreaterThanOrEqual(3);
    expect(m.fillerRate).toBeGreaterThan(10);
  });

  it("detects complexity markers", () => {
    const m = analyzeText({ text: "Although it rained, we went out because we had promised." });
    expect(m.complexityMarkers).toBeGreaterThanOrEqual(2);
  });

  it("fluency verdict bands from real metrics only", () => {
    const strong = analyzeText({
      text: "Yesterday I went to the library because I had to return some books, and while I was there I also borrowed two novels which look really interesting.",
      durationSec: 20,
    });
    expect(fluencyVerdict(strong).band).toBe("strong");

    const weak = analyzeText({ text: "um uh went", durationSec: 10 });
    expect(fluencyVerdict(weak).band).toBe("low");
  });

  it("empty text is safe", () => {
    const m = analyzeText({ text: "" });
    expect(m.words).toBe(0);
    expect(m.diversity).toBe(0);
  });

  it("word recognition against target is honest (no fabricated phonemes)", () => {
    const result = wordRecognitionAgainstTarget("comfortable chair", "comfortable chair");
    expect(result.every((w) => w.recognized)).toBe(true);
    const partial = wordRecognitionAgainstTarget("comfortable chair", "comfortable");
    expect(partial.find((w) => w.word === "chair")!.recognized).toBe(false);
  });
});
