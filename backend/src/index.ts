/**
 * HTTP API. Thin route layer: validate -> orchestrate -> respond.
 * All AI logic lives in tutor/orchestrator.ts.
 */

import express, { type Express } from "express";
import { loadConfig } from "./config";
import { buildProviderChain } from "./ai/registry";
import { createAuth, createRateLimiter, errorHandler, notFound } from "./middleware";
import {
  tutorTurn, evaluate, analyzeWriting, analyzeSpeaking, assessOpen,
  interviewReport, lookupVocabulary, type Deps,
} from "./tutor/orchestrator";
import {
  AssessmentRequestSchema, EvaluateRequestSchema, InterviewReportRequestSchema,
  SpeakingAnalyzeRequestSchema, TutorTurnRequestSchema, VocabularyLookupRequestSchema,
  WritingAnalyzeRequestSchema,
} from "../../shared/src/contracts";
import { buildDiagnosticResult, scoreObjectiveResponses, type AssessmentResponse } from "../../shared/src/assessment";

export const VERSION = "1.0.0";

export function createApp(env: NodeJS.ProcessEnv = process.env): Express {
  const config = loadConfig(env);
  const chain = buildProviderChain(config);
  const deps: Deps = { chain, dictionaryApiBase: config.dictionaryApiBase };
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(createRateLimiter(config.rateLimitWindowMs, config.rateLimitMax));
  app.use(createAuth(config.apiToken));

  // ---------- health ----------
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: VERSION,
      providers: chain.providers.map((p) => ({
        name: p.name,
        configured: p.isConfigured(),
        isDefault: p.name === chain.defaultProvider,
      })),
      defaultProvider: chain.defaultProvider,
    });
  });

  // ---------- tutor ----------
  app.post("/tutor", async (req, res, next) => {
    try {
      const body = TutorTurnRequestSchema.parse(req.body);
      res.json(await tutorTurn(body, deps));
    } catch (err) { next(err); }
  });

  app.post("/conversation", async (req, res, next) => {
    try {
      // Conversation is tutor with scenario mode enforced.
      const body = TutorTurnRequestSchema.parse(req.body);
      if (!body.scenario) {
        res.status(400).json({ error: { code: "validation_error", message: "scenario is required for /conversation" } });
        return;
      }
      res.json(await tutorTurn({ ...body, mode: body.mode === "interview" ? "interview" : "scenario" }, deps));
    } catch (err) { next(err); }
  });

  app.post("/evaluate", async (req, res, next) => {
    try {
      const body = EvaluateRequestSchema.parse(req.body);
      res.json(await evaluate(body, deps));
    } catch (err) { next(err); }
  });

  app.post("/writing/analyze", async (req, res, next) => {
    try {
      const body = WritingAnalyzeRequestSchema.parse(req.body);
      res.json(await analyzeWriting(body, deps));
    } catch (err) { next(err); }
  });

  app.post("/speaking/analyze", async (req, res, next) => {
    try {
      const body = SpeakingAnalyzeRequestSchema.parse(req.body);
      res.json(await analyzeSpeaking(body, deps));
    } catch (err) { next(err); }
  });

  app.post("/assessment", async (req, res, next) => {
    try {
      const body = AssessmentRequestSchema.parse(req.body);
      // 1. Score objective sections locally (deterministic, no AI).
      const objectiveResponses: AssessmentResponse[] = (req.body?.objectiveResponses ?? []) as AssessmentResponse[];
      const { sectionScores } = scoreObjectiveResponses(objectiveResponses);
      // 2. AI scores open sections when available.
      const { ai, meta } = await assessOpen(body, deps);
      const result = buildDiagnosticResult(
        sectionScores,
        ai
          ? { writing: ai.writingScore, speaking: ai.speakingScore }
          : undefined,
      );
      res.json({
        ...result,
        aiFeedback: ai
          ? { writingFeedback: ai.writingFeedback, speakingFeedback: ai.speakingFeedback, rationale: ai.rationale, estimatedLevel: ai.estimatedLevel }
          : null,
        meta,
      });
    } catch (err) { next(err); }
  });

  app.post("/interview/report", async (req, res, next) => {
    try {
      const body = InterviewReportRequestSchema.parse(req.body);
      res.json(await interviewReport(body, deps));
    } catch (err) { next(err); }
  });

  app.post("/vocabulary", async (req, res, next) => {
    try {
      const body = VocabularyLookupRequestSchema.parse(req.body);
      res.json(await lookupVocabulary(body, deps));
    } catch (err) { next(err); }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

/** Entry point when run directly (`npm start`). */
export function start(): void {
  const config = loadConfig();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({
      evt: "server_start", port: config.port,
      defaultProvider: buildProviderChain(config).defaultProvider,
      auth: config.apiToken ? "enabled" : "disabled (local dev)",
    }));
  });
  server.on("error", (err) => {
    console.error(JSON.stringify({ evt: "server_error", message: err.message }));
    process.exit(1);
  });
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("src/index.ts");
if (isDirectRun) start();
