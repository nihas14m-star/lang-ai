import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/index";
import type { Express } from "express";

let app: Express;

beforeAll(() => {
  app = createApp({
    // No AI keys: exercises the mock + local fallback paths end to end.
    PORT: "0",
  } as unknown as NodeJS.ProcessEnv);
});

function learner() {
  return {
    name: "Asha",
    nativeLanguage: "Tamil",
    cefrLevel: "B1",
    goals: ["fluency"],
    skillScores: { grammar: 55 },
    weakAreas: ["grammar"],
    activeMistakes: [
      { category: "tense", original: "Yesterday I go", corrected: "Yesterday I went", frequency: 3, stage: "guided" },
    ],
    knownVocabulary: ["college", "friend"],
  };
}

describe("GET /health", () => {
  it("reports provider configuration without leaking secrets", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.defaultProvider).toBe("mock");
    const body = JSON.stringify(res.body);
    expect(body.toLowerCase()).not.toContain("apikey");
    expect(body.toLowerCase()).not.toContain("authorization");
  });
});

describe("POST /tutor", () => {
  it("returns a validated tutor turn (mock path)", async () => {
    const res = await request(app).post("/tutor").send({
      sessionId: "sess-123456",
      mode: "free",
      learner: learner(),
      history: [],
      message: "Yesterday I go to college and meet my friend",
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeTruthy();
    expect(res.body.ttsText).toBeTruthy();
    expect(Array.isArray(res.body.corrections)).toBe(true);
    expect(res.body.meta.degraded).toBe(true); // mock is honest about being rule-based
  });

  it("rejects invalid bodies with 400 and details", async () => {
    const res = await request(app).post("/tutor").send({ mode: "free" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("rejects oversized messages", async () => {
    const res = await request(app).post("/tutor").send({
      sessionId: "sess-123456",
      mode: "free",
      learner: learner(),
      message: "x".repeat(5000),
    });
    expect(res.status).toBe(400);
  });

  it("works in scenario mode", async () => {
    const res = await request(app).post("/conversation").send({
      sessionId: "sess-123456",
      mode: "scenario",
      scenario: {
        id: "introductions",
        title: "Meeting new people",
        description: "Meet a classmate",
        objective: "Introduce yourself",
        difficulty: "A1",
        targetVocabulary: ["pleased to meet you"],
        targetGrammar: ["present simple"],
        successCriteria: ["said your name"],
      },
      learner: learner(),
      history: [],
      message: "Hi! I am Asha",
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeTruthy();
  });

  it("/conversation requires a scenario", async () => {
    const res = await request(app).post("/conversation").send({
      sessionId: "sess-123456",
      mode: "free",
      learner: learner(),
      message: "hello",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /evaluate", () => {
  it("evaluates a retry with structured output", async () => {
    const res = await request(app).post("/evaluate").send({
      kind: "retry",
      learner: learner(),
      prompt: "Say the sentence again",
      original: "Yesterday I go college",
      response: "Yesterday I went to college",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("correct");
    expect(res.body).toHaveProperty("score");
    expect(res.body).toHaveProperty("skillUpdates");
  });
});

describe("POST /writing/analyze", () => {
  it("degrades to rule-based analysis when no AI is configured", async () => {
    const res = await request(app).post("/writing/analyze").send({
      learner: learner(),
      taskType: "paragraph",
      text: "Yesterday I go to the market and buy vegetables. We discussed about the plan.",
    });
    expect(res.status).toBe(200);
    expect(res.body.overallScore).toBeGreaterThan(0);
    expect(res.body.meta.degraded).toBe(true);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });
});

describe("POST /speaking/analyze", () => {
  it("computes honest measured metrics and word recognition", async () => {
    const res = await request(app).post("/speaking/analyze").send({
      learner: learner(),
      transcript: "Um yesterday I go to college and I meet my friend we eat lunch",
      metrics: { durationSec: 20, pauseCount: 3, longestPauseSec: 1.2 },
      targetSentence: "Yesterday I went to college",
    });
    expect(res.status).toBe(200);
    expect(res.body.measured.words).toBe(14);
    expect(res.body.measured.wpm).toBe(42);
    expect(res.body.fluency.band).toBeOneOf(["low", "developing", "steady", "strong"]);
    expect(res.body.wordRecognition!.length).toBe(5);
    expect(res.body.pronunciationNote).toContain("NOT a pronunciation score");
  });
});

describe("POST /assessment", () => {
  it("scores objective responses locally and labels missing AI honestly", async () => {
    const res = await request(app).post("/assessment").send({
      learner: learner(),
      responses: [],
      objectiveResponses: [
        { itemId: "g1", answer: "is" },
        { itemId: "g2", answer: "are" },
        { itemId: "v1", answer: "expensive" },
        { itemId: "l1", answer: "I usually wake up at six in the morning." },
        { itemId: "r1", answer: "He didn't want to miss his flight" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.sections.length).toBeGreaterThan(0);
    expect(res.body.aiFeedback).toBeNull();
    expect(res.body.disclaimer).toContain("not an official");
  });

  it("uses the mock AI for open sections when no provider is configured", async () => {
    const res = await request(app).post("/assessment").send({
      learner: learner(),
      responses: [
        { itemId: "w1", section: "writing", prompt: "About your friend", response: "My friend is Ravi. He is kind.", metrics: {} },
        { itemId: "s1", section: "speaking", prompt: "Daily routine", response: "I wake up at six. I go to college.", metrics: { durationSec: 15 } },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.skillScores.writing).toBe(60); // mock's honest local estimate
    expect(res.body.meta.degraded).toBe(true);
  });
});

describe("POST /interview/report", () => {
  it("returns a report (mock) with all required fields", async () => {
    const res = await request(app).post("/interview/report").send({
      learner: learner(),
      scenario: {
        id: "interview_hr", title: "HR interview", description: "Entry level",
        objective: "Introduce yourself", difficulty: "B1",
        targetVocabulary: [], targetGrammar: [], successCriteria: [],
      },
      turns: [
        { role: "tutor", content: "Tell me about yourself." },
        { role: "user", content: "I am Asha. I am studying B.Tech final year." },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("overallScore");
    expect(Array.isArray(res.body.dimensions)).toBe(true);
  });
});

describe("POST /vocabulary", () => {
  it("falls back honestly when dictionary and AI are unavailable", async () => {
    const res = await request(app).post("/vocabulary").send({
      word: "serendipity",
      context: "It was pure serendipity that we met",
      learner: learner(),
    });
    // Offline CI environment: dictionary API unreachable, mock returns not-found.
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.body.found).toBe("boolean");
    }
  });
});

describe("404 handling", () => {
  it("returns a structured error", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("auth + rate limiting", () => {
  it("enforces a bearer token when configured", async () => {
    const secureApp = createApp({ API_TOKEN: "secret-token", PORT: "0" } as unknown as NodeJS.ProcessEnv);
    const denied = await request(secureApp).get("/health");
    expect(denied.status).toBe(401);
    const wrong = await request(secureApp).get("/health").set("Authorization", "Bearer wrong");
    expect(wrong.status).toBe(401);
    const ok = await request(secureApp).get("/health").set("Authorization", "Bearer secret-token");
    expect(ok.status).toBe(200);
  });

  it("rate limits per IP", async () => {
    const limitedApp = createApp({
      PORT: "0", RATE_LIMIT_MAX: "3", RATE_LIMIT_WINDOW_MS: "60000",
    } as unknown as NodeJS.ProcessEnv);
    for (let i = 0; i < 3; i++) {
      const res = await request(limitedApp).get("/health");
      expect(res.status).toBe(200);
    }
    const blocked = await request(limitedApp).get("/health");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("rate_limited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
