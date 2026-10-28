/**
 * Curriculum: topic taxonomy + adaptive prioritization.
 * Topics are grammar/usage units the curriculum rotates through.
 * Priority is derived from: mistake statistics, weak skills, CEFR level.
 */

import type { CefrLevel } from "./cefr";
import { levelIndex } from "./cefr";
import type { MistakeCategory, MistakeRecord } from "./mistakes";
import { categoryAccuracy } from "./mistakes";

export interface Topic {
  id: string;
  name: string;
  /** Minimum CEFR level at which this topic is introduced. */
  minLevel: CefrLevel;
  /** Mistake categories that map to this topic. */
  categories: MistakeCategory[];
  summary: string;
}

export const TOPICS: Topic[] = [
  { id: "present_simple", name: "Present simple", minLevel: "A1", categories: ["subject_verb_agreement", "tense"], summary: "Habits, facts, routines; third-person -s." },
  { id: "present_continuous", name: "Present continuous", minLevel: "A1", categories: ["tense"], summary: "Actions happening now or around now." },
  { id: "past_simple", name: "Past simple", minLevel: "A1", categories: ["tense"], summary: "Finished actions: went, met, saw." },
  { id: "articles", name: "Articles (a/an/the)", minLevel: "A1", categories: ["article"], summary: "When to use a, an, the — and when to use nothing." },
  { id: "prepositions", name: "Prepositions", minLevel: "A2", categories: ["preposition"], summary: "in/on/at for time and place; common verb+preposition pairs." },
  { id: "subject_verb_agreement", name: "Subject-verb agreement", minLevel: "A1", categories: ["subject_verb_agreement"], summary: "he/she/it + verb-s; is/are; has/have." },
  { id: "countable_uncountable", name: "Countable & uncountable nouns", minLevel: "A2", categories: ["singular_plural", "article"], summary: "much/many, some/any, advice vs advices." },
  { id: "future_forms", name: "Future forms", minLevel: "A2", categories: ["tense"], summary: "will vs going to vs present continuous for plans." },
  { id: "past_continuous", name: "Past continuous", minLevel: "A2", categories: ["tense"], summary: "was/were + -ing for background actions." },
  { id: "present_perfect", name: "Present perfect", minLevel: "B1", categories: ["tense"], summary: "have/has + past participle; experience and unfinished time." },
  { id: "comparatives", name: "Comparatives & superlatives", minLevel: "A2", categories: ["word_form"], summary: "bigger than / the biggest / more interesting." },
  { id: "modals", name: "Modal verbs", minLevel: "A2", categories: ["structure"], summary: "can, should, must, might for ability/advice/possibility." },
  { id: "conditionals", name: "Conditionals", minLevel: "B1", categories: ["structure"], summary: "If I were..., If you had..., zero/first/second conditional." },
  { id: "phrasal_verbs", name: "Phrasal verbs", minLevel: "B1", categories: ["word_choice"], summary: "get up, put off, run into — high-frequency daily verbs." },
  { id: "connectors", name: "Connectors & linking words", minLevel: "B1", categories: ["structure"], summary: "however, although, therefore, moreover for smooth writing." },
  { id: "relative_clauses", name: "Relative clauses", minLevel: "B1", categories: ["structure"], summary: "who/which/that clauses to add detail." },
  { id: "passive_voice", name: "Passive voice", minLevel: "B2", categories: ["structure"], summary: "The report was written... when the doer is less important." },
  { id: "reported_speech", name: "Reported speech", minLevel: "B2", categories: ["tense"], summary: "He said (that) he was... tense backshift." },
  { id: "word_order", name: "Word order", minLevel: "A1", categories: ["structure"], summary: "Subject-verb-object; adverb placement; questions." },
  { id: "question_formation", name: "Question formation", minLevel: "A1", categories: ["structure"], summary: "Do/does/did questions; Wh-questions; indirect questions." },
  { id: "register", name: "Formal vs informal register", minLevel: "B1", categories: ["word_choice"], summary: "Choosing words for interviews, emails, chat." },
  { id: "storytelling", name: "Storytelling in the past", minLevel: "B1", categories: ["tense", "structure"], summary: "Narrating events with past simple/continuous/perfect." },
  { id: "indian_english_register", name: "Indian & international English", minLevel: "A2", categories: ["word_choice"], summary: "Knowing both: prepone vs move earlier, discuss vs discuss about." },
];

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export interface TopicPriority {
  topic: Topic;
  /** 0-100, higher = should be practiced sooner. */
  priority: number;
  reason: string;
}

export interface CurriculumInput {
  cefrLevel: CefrLevel;
  mistakes: MistakeRecord[];
  /** Skill scores 0-100, when measured. */
  grammarScore?: number;
}

/**
 * Rank topics for this learner right now.
 * Signals (in order of weight):
 *  1. Recurring mistakes in the topic's categories (frequency × low accuracy)
 *  2. CEFR appropriateness (introduced at/below level; stretch topics slightly)
 *  3. Overall grammar weakness boosts fundamentals
 */
export function prioritizeTopics(input: CurriculumInput): TopicPriority[] {
  const nowIdx = levelIndex(input.cefrLevel);
  const ranked = TOPICS.map((topic) => {
    let priority = 0;
    const reasons: string[] = [];

    for (const cat of topic.categories) {
      const mistakesInCat = input.mistakes.filter((m) => m.category === cat);
      if (mistakesInCat.length === 0) continue;
      const freq = mistakesInCat.reduce((a, m) => a + m.frequency, 0);
      const acc = categoryAccuracy(input.mistakes, cat) ?? 1;
      const recency =
        (Math.max(...mistakesInCat.map((m) => m.lastSeenAt)) > Date.now() - 7 * 86400_000 ? 1.2 : 1.0);
      const signal = Math.min(40, freq * 4 * (1 - acc) * 4) * recency;
      if (signal > 3) {
        priority += signal;
        reasons.push(`${mistakesInCat.length} recurring mistake(s) in ${cat.replace(/_/g, " ")}`);
      }
    }

    const tIdx = levelIndex(topic.minLevel);
    if (tIdx <= nowIdx) priority += 20;
    else if (tIdx === nowIdx + 1) priority += 8; // stretch topic
    else priority -= 15;

    if (
      input.grammarScore !== undefined &&
      input.grammarScore < 55 &&
      ["present_simple", "past_simple", "subject_verb_agreement", "articles", "word_order"].includes(topic.id)
    ) {
      priority += 10;
      reasons.push("foundation topic while grammar score is developing");
    }

    const levelFit = tIdx <= nowIdx ? 1 : 0.5;
    priority = Math.max(0, Math.min(100, priority * levelFit + (tIdx <= nowIdx ? 10 : 0)));
    return { topic, priority, reason: reasons.length ? reasons.join("; ") : "level-appropriate practice" };
  });

  return ranked.sort((a, b) => b.priority - a.priority);
}

/** Next 2-3 concrete objectives for the profile screen. */
export function nextObjectives(input: CurriculumInput): string[] {
  return prioritizeTopics(input)
    .filter((t) => t.priority > 0)
    .slice(0, 3)
    .map((t) => `${t.topic.name} — ${t.reason}`);
}
