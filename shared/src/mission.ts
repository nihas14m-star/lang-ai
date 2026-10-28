/**
 * Daily mission generation.
 * Dynamically builds today's practice plan from the learner model:
 * due reviews, weakest topics, recent mistakes, and the daily goal minutes.
 * Deterministic for a given date + learner state (seeded).
 */

import type { CefrLevel } from "./cefr";
import type { MistakeRecord } from "./mistakes";
import { prioritizeTopics, type TopicPriority } from "./curriculum";
import { isDue, type SrsCard } from "./srs";

export type ActivityKind = "vocabulary_review" | "mistake_review" | "grammar_drill" | "speaking" | "listening" | "writing" | "conversation";

export interface MissionActivity {
  kind: ActivityKind;
  title: string;
  description: string;
  minutes: number;
  /** Parameters the screen needs to execute the activity. */
  params: {
    topicId?: string;
    drillCount?: number;
    scenarioId?: string;
    /** Max items for review activities. */
    maxItems?: number;
    prompt?: string;
  };
}

export interface DailyMission {
  dateKey: string; // YYYY-MM-DD (local)
  totalMinutes: number;
  activities: MissionActivity[];
  focusNote: string;
}

export interface MissionInput {
  cefrLevel: CefrLevel;
  dailyGoalMinutes: number;
  /** Words/mistakes currently scheduled for review. */
  dueVocabCount: number;
  dueMistakes: MistakeRecord[];
  mistakes: MistakeRecord[];
  /** Scenario ids available in the app (for conversation/speaking activities). */
  scenarioIds: string[];
  now: number;
  /** ISO date override (for tests). */
  dateKey?: string;
}

function dateKeyOf(now: number, override?: string): string {
  if (override) return override;
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateDailyMission(input: MissionInput): DailyMission {
  const dateKey = dateKeyOf(input.now, input.dateKey);
  const activities: MissionActivity[] = [];
  const priorities = prioritizeTopics({
    cefrLevel: input.cefrLevel,
    mistakes: input.mistakes,
  });
  const topWeak = priorities.filter((p) => p.priority > 0).slice(0, 3);

  let budget = Math.max(10, Math.min(60, input.dailyGoalMinutes));

  // 1. Due reviews always come first (spaced repetition is the backbone).
  const dueMistakeCards = input.dueMistakes.length;
  if (input.dueVocabCount > 0) {
    const mins = Math.max(2, Math.min(5, Math.ceil(input.dueVocabCount / 4)));
    if (budget >= mins) {
      activities.push({
        kind: "vocabulary_review",
        title: "Vocabulary review",
        description: `${input.dueVocabCount} word(s) scheduled for review`,
        minutes: mins,
        params: { maxItems: Math.min(input.dueVocabCount, 15) },
      });
      budget -= mins;
    }
  }
  if (dueMistakeCards > 0 && budget >= 2) {
    const mins = Math.min(3, budget);
    activities.push({
      kind: "mistake_review",
      title: "Fix past mistakes",
      description: `${dueMistakeCards} mistake(s) to retry`,
      minutes: mins,
      params: { maxItems: Math.min(dueMistakeCards, 8) },
    });
    budget -= mins;
  }

  // 2. Weak-topic grammar drill.
  if (budget >= 3 && topWeak.length > 0) {
    const primary: TopicPriority = topWeak[0]!;
    const mins = Math.min(5, budget);
    activities.push({
      kind: "grammar_drill",
      title: `Grammar: ${primary.topic.name}`,
      description: primary.reason,
      minutes: mins,
      params: { topicId: primary.topic.id, drillCount: 5 },
    });
    budget -= mins;
  }

  // 3. Speaking or conversation — rotate deterministically by date.
  const rotate = parseInt(dateKey.replace(/-/g, ""), 10) % 2;
  if (budget >= 4) {
    const mins = Math.min(budget, 6);
    if (rotate === 0) {
      activities.push({
        kind: "conversation",
        title: "Conversation practice",
        description: "Talk with your tutor in a real scenario",
        minutes: mins,
        params: { scenarioId: input.scenarioIds.length > 0 ? input.scenarioIds[(Math.abs(hash(dateKey)) % input.scenarioIds.length)]! : "introductions" },
      });
    } else {
      activities.push({
        kind: "speaking",
        title: "Speaking practice",
        description: "Describe your day in detail",
        minutes: mins,
        params: { prompt: "Describe what you did today, in 6-10 sentences. Then listen to the feedback." },
      });
    }
    budget -= mins;
  }

  // 4. Listening or writing, whichever skill is less recently practiced —
  //    the caller passes only what fits; here we add listening by default
  //    and writing when there's spare budget.
  if (budget >= 3) {
    const mins = Math.min(4, budget);
    activities.push({
      kind: "listening",
      title: "Listening practice",
      description: "Listen and answer",
      minutes: mins,
      params: {},
    });
    budget -= mins;
  }
  if (budget >= 4 && topWeak.length > 1) {
    activities.push({
      kind: "writing",
      title: "Short writing task",
      description: `Practice ${topWeak[1]!.topic.name} in writing`,
      minutes: Math.min(5, budget),
      params: {
        prompt: writingPromptFor(topWeak[1]!.topic.id),
      },
    });
    budget -= Math.min(5, budget);
  }

  const totalMinutes = activities.reduce((a, x) => a + x.minutes, 0);
  const focusNote =
    topWeak.length > 0
      ? `Today's focus: ${topWeak.map((t) => t.topic.name).join(", ")}`
      : "Today's focus: keep your streak and strengthen your conversation flow";

  return { dateKey, totalMinutes, activities, focusNote };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function writingPromptFor(topicId: string): string {
  const prompts: Record<string, string> = {
    past_simple: "Write 4-6 sentences about what you did last weekend. Use past tense verbs.",
    present_perfect: "Write 4 sentences about experiences you have had (travel, food, achievements). Use 'have/has + participle'.",
    articles: "Write 4 sentences describing your room. Pay attention to a/an/the.",
    prepositions: "Write 4-6 sentences describing your daily schedule. Use in/on/at correctly.",
    storytelling: "Write a short story (6-8 sentences) about a memorable journey.",
    register: "Write a short formal email asking your teacher for a deadline extension (4-6 sentences).",
    connectors: "Write 4-5 sentences about the advantages and disadvantages of social media, using 'however', 'although', 'therefore'.",
    conditionals: "Complete and write: 'If I could master one skill, ...' (4 sentences).",
  };
  return prompts[topicId] ?? "Write 4-6 sentences about your week.";
}

/** Are there items due for review? (helper for Home screen badge) */
export function countDue(cards: SrsCard[], now: number): number {
  return cards.filter((c) => isDue(c, now)).length;
}
