/**
 * App-layer tests (RN-independent modules).
 */

import { describe, expect, it } from "vitest";
import { localTutorTurn, localEvaluate } from "../src/ai/localTutor";
import { BACKEND_URL } from "../src/core/config";
import { LearnerSnapshotSchema, type LearnerSnapshotT } from "../../shared/src/contracts";

function snapshot(over: Partial<LearnerSnapshotT> = {}): LearnerSnapshotT {
  return LearnerSnapshotSchema.parse({ name: "Test", nativeLanguage: "Hindi", cefrLevel: "B1", ...over });
}

describe("offline local tutor", () => {
  it("corrects classic mistakes offline", () => {
    const turn = localTutorTurn({
      sessionId: "test-123456",
      mode: "scenario",
      learner: snapshot(),
      history: [],
      message: "Yesterday I go to college",
    });
    expect(turn.corrections.length).toBeGreaterThan(0);
    expect(turn.corrections[0]!.corrected.toLowerCase()).toContain("went");
    expect(turn.meta!.degraded).toBe(true);
    expect(turn.ttsText).toBeTruthy();
  });

  it("returns follow-up guidance without errors for clean input", () => {
    const turn = localTutorTurn({
      sessionId: "test-123456",
      mode: "free",
      learner: snapshot(),
      history: [],
      message: "I went to the library after class and borrowed two novels",
    });
    expect(turn.reply).toBeTruthy();
  });

  it("local evaluation flags bad grammar honestly", () => {
    const result = localEvaluate("He don't like tea", "retry");
    expect(result.correct).toBe(false);
    expect(result.corrections.length).toBeGreaterThan(0);
  });
});

describe("config", () => {
  it("uses the Android emulator host by default", () => {
    expect(BACKEND_URL).toBe("http://10.0.2.2:8787");
  });
});
