/**
 * API contracts between the Android app and the backend.
 * Zod schemas are the single source of truth; TypeScript types are inferred.
 * Every request the backend receives and every AI response it emits is
 * validated with these schemas at runtime.
 */

import { z } from "zod";

export const CefrLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type CefrLevelT = z.infer<typeof CefrLevelSchema>;

export const SkillSchema = z.enum([
  "grammar", "vocabulary", "speaking", "listening", "writing",
  "pronunciation", "fluency", "reading",
]);
export type SkillT = z.infer<typeof SkillSchema>;

export const MistakeCategorySchema = z.enum([
  "tense", "article", "preposition", "subject_verb_agreement", "singular_plural",
  "word_choice", "word_form", "spelling", "punctuation", "capitalization",
  "structure", "fluency", "vocabulary", "other",
]);

export const CorrectionSeveritySchema = z.enum(["critical", "improvement", "note"]);

export const CorrectionSchema = z.object({
  original: z.string().min(1).max(500),
  corrected: z.string().min(1).max(500),
  explanation: z.string().min(1).max(1000),
  category: MistakeCategorySchema,
  severity: CorrectionSeveritySchema,
});
export type CorrectionT = z.infer<typeof CorrectionSchema>;

export const VocabItemSchema = z.object({
  word: z.string().min(1).max(60),
  meaning: z.string().min(1).max(400),
  partOfSpeech: z.string().max(40).optional(),
  pronunciation: z.string().max(120).optional(),
  example: z.string().max(400).optional(),
  synonyms: z.array(z.string().max(40)).max(8).optional(),
  difficulty: CefrLevelSchema.optional(),
});
export type VocabItemT = z.infer<typeof VocabItemSchema>;

export const LearnerSnapshotSchema = z.object({
  name: z.string().max(80).default("Learner"),
  nativeLanguage: z.string().max(40).default("unknown"),
  cefrLevel: CefrLevelSchema,
  goals: z.array(z.string().max(80)).max(6).default([]),
  skillScores: z.record(SkillSchema, z.number().min(0).max(100)).default({}),
  weakAreas: z.array(SkillSchema).max(8).default([]),
  /** Active (unresolved) mistakes — most recent first, capped. */
  activeMistakes: z.array(z.object({
    category: MistakeCategorySchema,
    original: z.string().max(300),
    corrected: z.string().max(300),
    frequency: z.number().int().min(1).max(1000),
    stage: z.enum(["explicit", "guided", "subtle", "mastered"]).default("explicit"),
  })).max(12).default([]),
  /** Sample of known vocabulary so the tutor avoids re-teaching it. */
  knownVocabulary: z.array(z.string().max(40)).max(60).default([]),
});
export type LearnerSnapshotT = z.infer<typeof LearnerSnapshotSchema>;

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "tutor"]),
  content: z.string().min(1).max(4000),
});
export type ChatTurnT = z.infer<typeof ChatTurnSchema>;

export const ScenarioDescriptorSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  objective: z.string().min(1).max(300),
  difficulty: CefrLevelSchema,
  targetVocabulary: z.array(z.string().max(40)).max(12).default([]),
  targetGrammar: z.array(z.string().max(80)).max(6).default([]),
  successCriteria: z.array(z.string().max(200)).max(6).default([]),
});
export type ScenarioDescriptorT = z.infer<typeof ScenarioDescriptorSchema>;

export const TutorModeSchema = z.enum(["free", "scenario", "interview"]);

export const TutorTurnRequestSchema = z.object({
  sessionId: z.string().min(6).max(64),
  mode: TutorModeSchema,
  scenario: ScenarioDescriptorSchema.optional(),
  learner: LearnerSnapshotSchema,
  history: z.array(ChatTurnSchema).max(40).default([]),
  message: z.string().min(1).max(4000),
});
export type TutorTurnRequestT = z.infer<typeof TutorTurnRequestSchema>;

export const TutorTurnResponseSchema = z.object({
  reply: z.string().min(1).max(3000),
  ttsText: z.string().min(1).max(1500),
  corrections: z.array(CorrectionSchema).max(3).default([]),
  vocabulary: z.array(VocabItemSchema).max(3).default([]),
  followUp: z.string().max(400).optional(),
  scenarioProgress: z.object({
    objectiveMet: z.boolean(),
    progressNote: z.string().max(300),
  }).optional(),
  meta: z.object({
    provider: z.string().max(40),
    model: z.string().max(80),
    latencyMs: z.number().int().min(0),
    degraded: z.boolean().default(false),
  }).optional(),
});
export type TutorTurnResponseT = z.infer<typeof TutorTurnResponseSchema>;

// ---- Evaluation ----

export const EvaluateKindSchema = z.enum([
  "retry", "writing", "speaking_transcript", "vocabulary_usage", "interview_answer", "listening",
]);

export const EvaluateRequestSchema = z.object({
  kind: EvaluateKindSchema,
  learner: LearnerSnapshotSchema,
  prompt: z.string().max(2000).default(""),
  /** What the learner produced. */
  response: z.string().min(1).max(6000),
  /** Original sentence for retry evaluation. */
  original: z.string().max(2000).optional(),
  /** Optional model answer / target. */
  target: z.string().max(4000).optional(),
  scenario: ScenarioDescriptorSchema.optional(),
  history: z.array(ChatTurnSchema).max(40).default([]),
});
export type EvaluateRequestT = z.infer<typeof EvaluateRequestSchema>;

export const EvaluationResponseSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string().min(1).max(2000),
  corrections: z.array(CorrectionSchema).max(5).default([]),
  vocabulary: z.array(VocabItemSchema).max(4).default([]),
  shouldRetry: z.boolean().default(false),
  /** Concrete measurable notes the app records into the learner model. */
  skillUpdates: z.array(z.object({
    skill: SkillSchema,
    correct: z.boolean(),
    quality: z.number().min(0).max(1).optional(),
  })).max(4).default([]),
  meta: z.object({
    provider: z.string().max(40),
    model: z.string().max(80),
    latencyMs: z.number().int().min(0),
    degraded: z.boolean().default(false),
  }).optional(),
});
export type EvaluationResponseT = z.infer<typeof EvaluationResponseSchema>;

// ---- Writing analysis ----

export const WritingAnalyzeRequestSchema = z.object({
  learner: LearnerSnapshotSchema,
  text: z.string().min(1).max(8000),
  taskType: z.enum(["sentence", "paragraph", "email", "essay", "summary"]).default("paragraph"),
  prompt: z.string().max(2000).optional(),
});
export type WritingAnalyzeRequestT = z.infer<typeof WritingAnalyzeRequestSchema>;

export const WritingAnalysisResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string().max(300)).max(5).default([]),
  issues: z.array(z.object({
    type: z.enum(["grammar", "clarity", "vocabulary", "structure", "coherence", "naturalness"]),
    original: z.string().max(400),
    suggestion: z.string().max(400),
    explanation: z.string().max(600),
  })).max(8).default([]),
  improvedVersion: z.string().max(8000),
  dontAutoRewriteNote: z.string().max(300).default("Try revising yourself first; the improved version is a reference, not the answer."),
  meta: z.object({
    provider: z.string().max(40),
    model: z.string().max(80),
    latencyMs: z.number().int().min(0),
    degraded: z.boolean().default(false),
  }).optional(),
});
export type WritingAnalysisResponseT = z.infer<typeof WritingAnalysisResponseSchema>;

// ---- Speaking analysis ----

export const SpeakingAnalyzeRequestSchema = z.object({
  learner: LearnerSnapshotSchema,
  transcript: z.string().min(1).max(6000),
  /** Real measured metrics from the device recorder. */
  metrics: z.object({
    durationSec: z.number().min(0).max(3600).optional(),
    pauseCount: z.number().int().min(0).max(1000).optional(),
    longestPauseSec: z.number().min(0).max(600).optional(),
  }).default({}),
  /** If set: word-recognition comparison target (pronunciation-adjacent, honestly labeled). */
  targetSentence: z.string().max(1000).optional(),
  prompt: z.string().max(1000).optional(),
});
export type SpeakingAnalyzeRequestT = z.infer<typeof SpeakingAnalyzeRequestSchema>;

export const SpeakingAnalysisResponseSchema = z.object({
  feedback: z.string().min(1).max(2000),
  corrections: z.array(CorrectionSchema).max(5).default([]),
  vocabulary: z.array(VocabItemSchema).max(3).default([]),
  /** Computed server-side from real measurements (shared/analysis). */
  measured: z.object({
    wpm: z.number().int().nullable(),
    fillerCount: z.number().int(),
    fillerRate: z.number(),
    diversity: z.number(),
    avgSentenceLength: z.number(),
    words: z.number().int(),
  }),
  fluency: z.object({
    band: z.enum(["low", "developing", "steady", "strong"]),
    reasons: z.array(z.string().max(300)).max(6),
  }),
  /** HONEST pronunciation signal: ASR word recognition, NOT a pronunciation score. */
  wordRecognition: z.array(z.object({
    word: z.string().max(60),
    recognized: z.boolean(),
  })).max(60).optional(),
  pronunciationNote: z.string().max(300).default(
    "Word recognition is a hint, not a pronunciation score. Phoneme-level analysis is not available in this build."
  ),
  shouldRetry: z.boolean().default(false),
  meta: z.object({
    provider: z.string().max(40),
    model: z.string().max(80),
    latencyMs: z.number().int().min(0),
    degraded: z.boolean().default(false),
  }).optional(),
});
export type SpeakingAnalysisResponseT = z.infer<typeof SpeakingAnalysisResponseSchema>;

// ---- Assessment ----

export const AssessmentOpenItemSchema = z.object({
  itemId: z.string().min(1).max(40),
  section: z.enum(["writing", "speaking"]),
  prompt: z.string().max(2000),
  response: z.string().min(1).max(6000),
  metrics: z.object({
    durationSec: z.number().min(0).max(3600).optional(),
  }).default({}),
});
export type AssessmentOpenItemT = z.infer<typeof AssessmentOpenItemSchema>;

export const AssessmentRequestSchema = z.object({
  learner: LearnerSnapshotSchema,
  responses: z.array(AssessmentOpenItemSchema).max(6).default([]),
});
export type AssessmentRequestT = z.infer<typeof AssessmentRequestSchema>;

export const AssessmentAIResultSchema = z.object({
  writingScore: z.number().min(0).max(100),
  speakingScore: z.number().min(0).max(100),
  writingFeedback: z.string().max(1000).default(""),
  speakingFeedback: z.string().max(1000).default(""),
  estimatedLevel: CefrLevelSchema,
  rationale: z.string().max(600).default(""),
});
export type AssessmentAIResultT = z.infer<typeof AssessmentAIResultSchema>;

// ---- Vocabulary ----

export const VocabularyLookupRequestSchema = z.object({
  word: z.string().min(1).max(60),
  context: z.string().max(600).optional(),
  learner: LearnerSnapshotSchema,
});
export type VocabularyLookupRequestT = z.infer<typeof VocabularyLookupRequestSchema>;

export const VocabularyLookupResponseSchema = z.object({
  found: z.boolean(),
  item: VocabItemSchema.nullable(),
  source: z.enum(["dictionary-api", "ai", "cache", "none"]),
  learnerHint: z.string().max(300).optional(),
  meta: z.object({
    provider: z.string().max(40).default(""),
    latencyMs: z.number().int().min(0).default(0),
  }).optional(),
});
export type VocabularyLookupResponseT = z.infer<typeof VocabularyLookupResponseSchema>;

// ---- Interview report ----

export const InterviewReportRequestSchema = z.object({
  learner: LearnerSnapshotSchema,
  scenario: ScenarioDescriptorSchema,
  turns: z.array(ChatTurnSchema).max(60),
});
export type InterviewReportRequestT = z.infer<typeof InterviewReportRequestSchema>;

export const InterviewReportResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  dimensions: z.array(z.object({
    name: z.enum(["grammar", "clarity", "vocabulary", "structure", "relevance", "conciseness"]),
    score: z.number().min(0).max(100),
    comment: z.string().max(300),
  })).max(6),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
  suggestedAnswer: z.string().max(3000),
  meta: z.object({
    provider: z.string().max(40),
    model: z.string().max(80),
    latencyMs: z.number().int().min(0),
    degraded: z.boolean().default(false),
  }).optional(),
});
export type InterviewReportResponseT = z.infer<typeof InterviewReportResponseSchema>;

// ---- Health ----

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  providers: z.array(z.object({
    name: z.string(),
    configured: z.boolean(),
    isDefault: z.boolean(),
  })),
  defaultProvider: z.string(),
});
export type HealthResponseT = z.infer<typeof HealthResponseSchema>;

// ---- Errors (consistent shape) ----

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponseT = z.infer<typeof ErrorResponseSchema>;
