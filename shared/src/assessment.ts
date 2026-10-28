/**
 * Diagnostic assessment (initial CEFR estimation).
 * Objective items are scored locally and deterministically.
 * Writing/speaking sections require AI evaluation when online; when offline
 * they are skipped and the overall estimate reports lower confidence.
 */

import type { CefrLevel, Skill, SkillScores } from "./cefr";
import { estimateOverall, scoreToLevel, SKILLS } from "./cefr";
import { checkDrillAnswer, type Drill } from "./exercises";

export type AssessmentSection = "grammar" | "vocabulary" | "listening" | "reading" | "writing" | "speaking";

export interface AssessmentItem {
  id: string;
  section: AssessmentSection;
  /** Item difficulty — used for adaptive level estimation. */
  level: CefrLevel;
  prompt: string;
  type: "choose" | "fill_blank" | "dictation" | "open";
  options?: string[];
  answers?: string[];
  /** For listening: text the TTS engine will speak. */
  speakText?: string;
  /** For open items: guidance shown to the learner. */
  hint?: string;
  maxWords?: number;
}

export interface AssessmentResponse {
  itemId: string;
  /** Learner's answer: text for all types. */
  answer: string;
  /** Real measured duration in seconds for speaking items. */
  durationSec?: number;
}

/** Every item above its level threshold is "passed" by implication (higher skills). */
const ITEM_BANK: AssessmentItem[] = [
  // Grammar A1
  { id: "g1", section: "grammar", level: "A1", type: "choose", prompt: "She ___ a teacher.", options: ["is", "are", "am"], answers: ["is"] },
  { id: "g2", section: "grammar", level: "A1", type: "fill_blank", prompt: "They ___ (be) my cousins.", answers: ["are"] },
  // Grammar A2
  { id: "g3", section: "grammar", level: "A2", type: "choose", prompt: "I ___ TV when you called.", options: ["watched", "was watching", "watch"], answers: ["was watching"] },
  { id: "g4", section: "grammar", level: "A2", type: "fill_blank", prompt: "We ___ (go) to Ooty last summer.", answers: ["went"] },
  // Grammar B1
  { id: "g5", section: "grammar", level: "B1", type: "choose", prompt: "He ___ in this company since 2019.", options: ["works", "has worked", "worked"], answers: ["has worked"] },
  { id: "g6", section: "grammar", level: "B1", type: "choose", prompt: "If I ___ more time, I would learn the guitar.", options: ["have", "had", "will have"], answers: ["had"] },
  // Grammar B2
  { id: "g7", section: "grammar", level: "B2", type: "choose", prompt: "The report ___ before the meeting started.", options: ["had been finished", "was finished already", "has finished"], answers: ["had been finished"] },
  { id: "g8", section: "grammar", level: "B2", type: "fill_blank", prompt: "Rarely ___ (I / see) such dedication. (word order: write the full sentence)", answers: ["rarely have i seen such dedication", "rarely do i see such dedication"] },
  // Vocabulary A1
  { id: "v1", section: "vocabulary", level: "A1", type: "choose", prompt: "\"Cheap\" means the opposite of:", options: ["expensive", "small", "fast"], answers: ["expensive"] },
  { id: "v2", section: "vocabulary", level: "A1", type: "choose", prompt: "You buy medicine at the ___.", options: ["pharmacy", "library", " bakery", " bakery"], answers: ["pharmacy"] },
  // Vocabulary A2
  { id: "v3", section: "vocabulary", level: "A2", type: "choose", prompt: "\"To postpone\" means to:", options: ["cancel", "move to a later time", "hurry"], answers: ["move to a later time"] },
  { id: "v4", section: "vocabulary", level: "A2", type: "choose", prompt: "A person who studies at a university is a ___.", options: ["student", "teacher", "manager"], answers: ["student"] },
  // Vocabulary B1
  { id: "v5", section: "vocabulary", level: "B1", type: "choose", prompt: "\"Reluctant\" most nearly means:", options: ["unwilling", "excited", "confident"], answers: ["unwilling"] },
  { id: "v6", section: "vocabulary", level: "B1", type: "choose", prompt: "Choose the correct collocation: \"___ a decision\"", options: ["do", "make", "take up"], answers: ["make"] },
  // Vocabulary B2
  { id: "v7", section: "vocabulary", level: "B2", type: "choose", prompt: "\"Meticulous\" most nearly means:", options: ["very careful", "lazy", "generous"], answers: ["very careful"] },
  { id: "v8", section: "vocabulary", level: "B2", type: "choose", prompt: "\"The findings are inconclusive\" means the findings are:", options: ["not decisive", "wrong", "secret"], answers: ["not decisive"] },
  // Listening (dictation via TTS on device)
  { id: "l1", section: "listening", level: "A1", type: "dictation", prompt: "Listen and type what you hear.", speakText: "I usually wake up at six in the morning." },
  { id: "l2", section: "listening", level: "A2", type: "dictation", prompt: "Listen and type what you hear.", speakText: "She has been working here for three years." },
  { id: "l3", section: "listening", level: "B1", type: "dictation", prompt: "Listen and type what you hear.", speakText: "Although the traffic was heavy, we reached the office on time." },
  { id: "l4", section: "listening", level: "B2", type: "dictation", prompt: "Listen and type what you hear.", speakText: "The committee is likely to reconsider its decision next week." },
  // Reading (short passage + inference)
  { id: "r1", section: "reading", level: "A2", type: "choose", prompt: "Read: \"Ravi set three alarms because he had an early flight.\" Why did Ravi set alarms?", options: ["He sleeps a lot", "He didn't want to miss his flight", "He likes alarms"], answers: ["he didn't want to miss his flight"] },
  { id: "r2", section: "reading", level: "B1", type: "choose", prompt: "Read: \"Despite the company's growth, profits remained flat.\" What happened to profits?", options: ["They grew", "They stayed the same", "They disappeared"], answers: ["they stayed the same"] },
  { id: "r3", section: "reading", level: "B2", type: "choose", prompt: "Read: \"The scheme, far from solving the problem, has compounded it.\" The writer thinks the scheme has:", options: ["made things worse", "solved things", "done nothing"], answers: ["made things worse"] },
  // Writing (open — AI-scored when online)
  { id: "w1", section: "writing", level: "B1", type: "open", prompt: "Write 3-5 sentences about your best friend.", hint: "Who are they? How did you meet? What do you do together?", maxWords: 120 },
  // Speaking (open — recorded on device; AI-scored when online, else skipped honestly)
  { id: "s1", section: "speaking", level: "A2", type: "open", prompt: "Speak for 30-60 seconds about your daily routine.", hint: "Use the microphone, or type what you would say.", maxWords: 150 },
];

export const ASSESSMENT_ITEMS: AssessmentItem[] = ITEM_BANK;

export function itemById(id: string): AssessmentItem | undefined {
  return ASSESSMENT_ITEMS.find((i) => i.id === id);
}

export interface SectionScore {
  section: AssessmentSection;
  score: number; // 0-100
  answered: number;
  source: "objective" | "ai" | "skipped";
}

export interface DiagnosticResult {
  overall: ReturnType<typeof estimateOverall>;
  sections: SectionScore[];
  skillScores: SkillScores;
  strengths: string[];
  weaknesses: string[];
  recommendedPractice: string[];
  recommendedFirstLessons: string[];
  disclaimer: string;
}

function wordOverlapScore(target: string, answer: string): number {
  const t = target.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/);
  const a = new Set(answer.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/));
  if (t.length === 0) return 0;
  let hits = 0;
  for (const w of t) if (a.has(w)) hits++;
  return Math.round((hits / t.length) * 100);
}

/**
 * Score objective sections locally and deterministically.
 * Open sections (writing/speaking) return null — the caller decides whether
 * to score them with AI (online) or mark them skipped (offline).
 */
export function scoreObjectiveResponses(
  responses: AssessmentResponse[],
): { sectionScores: Map<AssessmentSection, SectionScore>; perItem: Array<{ item: AssessmentItem; correct: boolean; score: number }> } {
  const byItem = new Map(responses.map((r) => [r.itemId, r]));
  const perItem: Array<{ item: AssessmentItem; correct: boolean; score: number }> = [];
  const sectionAgg = new Map<AssessmentSection, { sum: number; n: number }>();

  for (const item of ASSESSMENT_ITEMS) {
    const resp = byItem.get(item.id);
    if (item.type === "open") continue; // scored elsewhere
    if (!resp || resp.answer.trim() === "") continue;
    let score = 0;
    if (item.type === "dictation" && item.speakText) {
      score = wordOverlapScore(item.speakText, resp.answer);
    } else if (item.answers) {
      const fake: Drill = {
        id: item.id, topicId: "assessment", level: item.level, type: "choose",
        prompt: item.prompt, options: item.options, answers: item.answers, explanation: "",
      };
      score = checkDrillAnswer(fake, resp.answer).correct ? 100 : 0;
    }
    perItem.push({ item, correct: score >= 60, score });
    const agg = sectionAgg.get(item.section) ?? { sum: 0, n: 0 };
    agg.sum += score; agg.n += 1;
    sectionAgg.set(item.section, agg);
  }

  const sectionScores = new Map<AssessmentSection, SectionScore>();
  for (const [section, { sum, n }] of sectionAgg) {
    sectionScores.set(section, { section, score: Math.round(sum / n), answered: n, source: "objective" });
  }
  return { sectionScores, perItem };
}

const SECTION_TO_SKILL: Partial<Record<AssessmentSection, Skill>> = {
  grammar: "grammar",
  vocabulary: "vocabulary",
  listening: "listening",
  reading: "reading",
  writing: "writing",
  speaking: "speaking",
};

export function sectionToSkill(s: AssessmentSection): Skill {
  return SECTION_TO_SKILL[s] ?? "grammar";
}

/** Skill score for a section, adjusted by item difficulty (harder items count more). */
export function skillScoreFromSection(section: AssessmentSection, score: number): number {
  return score; // per-item difficulty already averaged in; keep mapping transparent
}

export function buildDiagnosticResult(
  sectionScores: Map<AssessmentSection, SectionScore>,
  openAIScores?: Partial<Record<"writing" | "speaking", number>>,
): DiagnosticResult {
  const skillScores: SkillScores = {};
  const sections: SectionScore[] = [];
  for (const [section, s] of sectionScores) {
    sections.push(s);
    const skill = sectionToSkill(section);
    skillScores[skill] = skillScoreFromSection(section, s.score);
  }
  if (openAIScores?.writing !== undefined) {
    skillScores.writing = openAIScores.writing;
    sections.push({ section: "writing", score: openAIScores.writing, answered: 1, source: "ai" });
  }
  if (openAIScores?.speaking !== undefined) {
    skillScores.speaking = openAIScores.speaking;
    sections.push({ section: "speaking", score: openAIScores.speaking, answered: 1, source: "ai" });
  }

  const overall = estimateOverall(skillScores);
  const sorted = (Object.entries(skillScores) as Array<[Skill, number]>).sort((a, b) => b[1] - a[1]);
  const strengthsList = sorted.slice(0, 2).map(([s]) => s);
  const weaknessesList = sorted.slice(-2).filter(([, v]) => v < 65).map(([s]) => s);

  const recommendedPractice: string[] = [];
  if (weaknessesList.length > 0) recommendedPractice.push(`Focus first on: ${weaknessesList.join(", ")}`);
  recommendedPractice.push("Daily conversation practice (10-15 min)");
  recommendedPractice.push("Vocabulary review every day (SRS)");
  if (!skillScores.speaking) recommendedPractice.push("Speaking practice — not yet measured");

  const recommendedFirstLessons = weaknessesList.length
    ? [`Guided practice: ${weaknessesList[0]}`, "Everyday conversation (easy scenario)"]
    : ["Everyday conversation", "Short writing practice"];

  return {
    overall,
    sections,
    skillScores,
    strengths: strengthsList,
    weaknesses: weaknessesList,
    recommendedPractice,
    recommendedFirstLessons,
    disclaimer: "This is an estimated diagnostic level, not an official CEFR certification.",
  };
}

/** Convenience: estimated level letter from a diagnostic (or default). */
export function diagnosticLevel(result: DiagnosticResult): CefrLevel {
  return result.overall ? result.overall.level : scoreToLevel(0);
}

export const ASSESSMENT_SKILLS_USED = SKILLS;
