/**
 * Typed backend client.
 * - Validates every response with the shared zod contracts.
 * - Normalizes failures into ApiError (never crashes the UI).
 */

import { BACKEND_URL, REQUEST_TIMEOUT_MS } from "./config";
import {
  HealthResponseSchema, TutorTurnResponseSchema, EvaluationResponseSchema,
  WritingAnalysisResponseSchema, SpeakingAnalysisResponseSchema,
  VocabularyLookupResponseSchema, InterviewReportResponseSchema,
  type HealthResponseT, type TutorTurnRequestT, type TutorTurnResponseT,
  type EvaluateRequestT, type EvaluationResponseT, type WritingAnalyzeRequestT,
  type WritingAnalysisResponseT, type SpeakingAnalyzeRequestT,
  type SpeakingAnalysisResponseT, type VocabularyLookupRequestT,
  type VocabularyLookupResponseT, type InterviewReportRequestT,
  type InterviewReportResponseT, type AssessmentRequestT,
} from "../../../shared/src/contracts";
import type { DiagnosticResult } from "../../../shared/src/assessment";

export class ApiError extends Error {
  constructor(
    readonly kind: "offline" | "timeout" | "server" | "invalid",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, parse: (data: unknown) => T, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `Server error (${res.status})`;
      try {
        const errBody = (await res.json()) as { error?: { message?: string } };
        message = errBody.error?.message ?? message;
      } catch { /* keep default */ }
      throw new ApiError(res.status === 429 ? "server" : "server", message, res.status);
    }
    const data: unknown = await res.json();
    const parsed = parse(data);
    return parsed;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("timeout", "The tutor service took too long to respond.");
    }
    throw new ApiError("offline", "Cannot reach the tutor service. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

export interface AssessmentApiResponse extends DiagnosticResult {
  aiFeedback: {
    writingFeedback: string;
    speakingFeedback: string;
    rationale: string;
    estimatedLevel: string;
  } | null;
}

export const api = {
  health: (): Promise<HealthResponseT> =>
    request("/health", (d) => HealthResponseSchema.parse(d)),

  tutorTurn: (body: TutorTurnRequestT): Promise<TutorTurnResponseT> =>
    request("/tutor", (d) => TutorTurnResponseSchema.parse(d), body),

  evaluate: (body: EvaluateRequestT): Promise<EvaluationResponseT> =>
    request("/evaluate", (d) => EvaluationResponseSchema.parse(d), body),

  analyzeWriting: (body: WritingAnalyzeRequestT): Promise<WritingAnalysisResponseT> =>
    request("/writing/analyze", (d) => WritingAnalysisResponseSchema.parse(d), body),

  analyzeSpeaking: (body: SpeakingAnalyzeRequestT): Promise<SpeakingAnalysisResponseT> =>
    request("/speaking/analyze", (d) => SpeakingAnalysisResponseSchema.parse(d), body),

  assessment: (body: AssessmentRequestT): Promise<AssessmentApiResponse> =>
    request("/assessment", (d) => d as AssessmentApiResponse, body),

  interviewReport: (body: InterviewReportRequestT): Promise<InterviewReportResponseT> =>
    request("/interview/report", (d) => InterviewReportResponseSchema.parse(d), body),

  vocabulary: (body: VocabularyLookupRequestT): Promise<VocabularyLookupResponseT> =>
    request("/vocabulary", (d) => VocabularyLookupResponseSchema.parse(d), body),
};
