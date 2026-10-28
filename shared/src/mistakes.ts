/**
 * Mistake taxonomy + persistence helpers.
 * The AI classifies mistakes; these helpers normalize, merge and schedule them.
 */

export const MISTAKE_CATEGORIES = [
  "tense",
  "article",
  "preposition",
  "subject_verb_agreement",
  "singular_plural",
  "word_choice",
  "word_form",
  "spelling",
  "punctuation",
  "capitalization",
  "structure",
  "fluency",
  "vocabulary",
  "other",
] as const;
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export function isMistakeCategory(v: string): v is MistakeCategory {
  return (MISTAKE_CATEGORIES as readonly string[]).includes(v);
}

export interface MistakeRecord {
  id: string;
  category: MistakeCategory;
  original: string;
  corrected: string;
  explanation: string;
  /** Context: short excerpt of the surrounding learner message. */
  context: string;
  /** Times this mistake pattern has been seen. */
  frequency: number;
  /** Times the learner has subsequently produced the correct form. */
  correctCount: number;
  /** 0-100 confidence that this is a genuine recurring error. */
  confidence: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** SM-2 card fields for review scheduling. */
  srs: import("./srs").SrsCard;
}

/** Mistake stages: feedback style gradually becomes subtler. */
export type CorrectionStage = "explicit" | "guided" | "subtle" | "mastered";

export interface MistakeStats {
  attempts: number;
  correct: number;
  accuracy: number; // 0-1
  stage: CorrectionStage;
}

/**
 * Progression:
 *  - accuracy < 40%            -> explicit ("use the past tense: go -> went")
 *  - accuracy < 70%            -> guided ("remember what we said about yesterday?")
 *  - accuracy < 90%            -> subtle (underline/flag only)
 *  - accuracy >= 90% + 6+ seen -> mastered (no correction unless meaning breaks)
 */
export function mistakeStats(m: MistakeRecord): MistakeStats {
  const attempts = m.frequency;
  const correct = m.correctCount;
  const accuracy = attempts === 0 ? 0 : correct / attempts;
  let stage: CorrectionStage;
  if (attempts >= 6 && accuracy >= 0.9) stage = "mastered";
  else if (accuracy >= 0.7) stage = "subtle";
  else if (accuracy >= 0.4) stage = "guided";
  else stage = "explicit";
  return { attempts, correct, accuracy, stage };
}

/** Merge a newly observed mistake into the store's records. */
export function mergeMistake(
  existing: MistakeRecord | undefined,
  incoming: Omit<MistakeRecord, "id" | "frequency" | "correctCount" | "confidence" | "firstSeenAt" | "lastSeenAt" | "srs">,
  now: number,
): MistakeRecord {
  if (!existing) {
    return {
      ...incoming,
      id: `${incoming.category}:${incoming.original.toLowerCase().replace(/\s+/g, "_")}`.slice(0, 120),
      frequency: 1,
      correctCount: 0,
      confidence: 60,
      firstSeenAt: now,
      lastSeenAt: now,
      srs: { repetitions: 0, ease: 2.5, intervalDays: 0, dueAt: now, lapses: 0 },
    };
  }
  const samePattern =
    existing.category === incoming.category &&
    normalize(existing.original) === normalize(incoming.original);
  return {
    ...existing,
    corrected: incoming.corrected || existing.corrected,
    explanation: incoming.explanation || existing.explanation,
    context: incoming.context || existing.context,
    frequency: existing.frequency + (samePattern ? 1 : 0),
    confidence: Math.min(100, existing.confidence + (samePattern ? 10 : 0)),
    lastSeenAt: now,
  };
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/** Accuracy of a specific category across all recorded mistakes. */
export function categoryAccuracy(mistakes: MistakeRecord[], category: MistakeCategory): number | null {
  const inCategory = mistakes.filter((m) => m.category === category);
  if (inCategory.length === 0) return null;
  const attempts = inCategory.reduce((a, m) => a + m.frequency, 0);
  const correct = inCategory.reduce((a, m) => a + m.correctCount, 0);
  return attempts === 0 ? null : correct / attempts;
}

/**
 * Lightweight client-side heuristic detector used by the OFFLINE tutor only.
 * The online tutor uses the AI for classification. These rules are
 * intentionally conservative (high precision, low recall).
 */
export interface HeuristicHit {
  category: MistakeCategory;
  original: string;
  corrected: string;
  explanation: string;
}

const HEURISTICS: Array<{
  re: RegExp;
  category: MistakeCategory;
  fix: (m: RegExpMatchArray) => { corrected: string; explanation: string } | null;
}> = [
  {
    // "yesterday I go" / "last week he meet" — obvious past-tense misses
    re: /\b(yesterday|last (?:night|week|month|year)|ago)\b[^.!?]*?\b(go|come|meet|eat|see|take|buy|write|speak|tell|get|give|make|drive|run|read)\b(?!\s+(?:to|the|a|an|my|his|her|our|their|your|its|him|her|them|it|home|there|here|out|up|down|back)\b)/i,
    category: "tense",
    fix: (m) => {
      const table: Record<string, string> = {
        go: "went", come: "came", meet: "met", eat: "ate", see: "saw",
        take: "took", buy: "bought", write: "wrote", speak: "spoke",
        tell: "told", get: "got", give: "gave", make: "made", drive: "drove",
        run: "ran", read: "read",
      };
      const verb = m[2]!.toLowerCase();
      const past = table[verb];
      if (!past || verb === past) return null;
      return {
        corrected: m[0]!.replace(new RegExp(`\\b${verb}\\b`, "i"), past),
        explanation: `The time marker "${m[1]}" means the action already happened, so use the past tense: ${verb} → ${past}.`,
      };
    },
  },
  {
    re: /\b(he|she|it)\s+(are|were|have)\b/i,
    category: "subject_verb_agreement",
    fix: (m) => ({
      corrected: m[0]!.replace(/\bare\b/i, "is").replace(/\bwere\b/i, "was").replace(/\bhave\b/i, "has"),
      explanation: `"${m[1]}" is a singular subject, so use "is/was/has".`,
    }),
  },
  {
    re: /\b(he|she|it)\s+(go|come|make|take|want|need|like|know|think|work|play|study|watch|do|does not|doesn't)\b/i,
    category: "subject_verb_agreement",
    fix: (m) => {
      const verb = m[2]!.toLowerCase();
      if (verb === "does not" || verb === "doesn't") return null;
      return {
        corrected: m[0]!.replace(new RegExp(`\\b${verb}\\b`, "i"), `${verb}s`),
        explanation: `With "he/she/it", most present-tense verbs take an -s: ${verb} → ${verb}s.`,
      };
    },
  },
  {
    re: /\b(he|she|it)\s+(don't|do not)\b/i,
    category: "subject_verb_agreement",
    fix: (m) => ({
      corrected: m[0]!.replace(/\bdon't\b/i, "doesn't").replace(/\bdo not\b/i, "does not"),
      explanation: `"${m[1]}" is singular, so use "doesn't" (or "does not").`,
    }),
  },
  {
    re: /\b(i|you|we|they)\s+(is|was|has)\b/i,
    category: "subject_verb_agreement",
    fix: (m) => ({
      corrected: m[0]!.replace(/\bis\b/i, "am/are").replace(/\bwas\b/i, "were").replace(/\bhas\b/i, "have"),
      explanation: `"${m[1]}" takes "am/are", "were" or "have".`,
    }),
  },
  {
    re: /\bdiscuss(?:ed|ing|es)? about\b/i,
    category: "word_choice",
    fix: (m) => ({ corrected: m[0]!.replace(/\s+about$/i, ""), explanation: '"Discuss" already includes "about": "We discussed the plan." (Common in Indian English; internationally "discuss" is used alone.)' }),
  },
  {
    re: /\breturn back\b/i,
    category: "word_choice",
    fix: () => ({ corrected: "return", explanation: '"Return" already means "go back", so "back" is redundant.' }),
  },
  {
    re: /\bcope up with\b/i,
    category: "word_choice",
    fix: () => ({ corrected: "cope with", explanation: 'The phrase is "cope with" (or "keep up with").' }),
  },
  {
    re: /\brevert back\b/i,
    category: "word_choice",
    fix: () => ({ corrected: "reply", explanation: 'In international usage "revert" means "return to a previous state". For emails, "I will reply soon" is clearer.' }),
  },
  {
    re: /\btoday morning\b/i,
    category: "word_choice",
    fix: () => ({ corrected: "this morning", explanation: 'English uses "this morning", not "today morning".' }),
  },
  {
    re: /\byesterday night\b/i,
    category: "word_choice",
    fix: () => ({ corrected: "last night", explanation: 'English uses "last night", not "yesterday night".' }),
  },
  {
    re: /\bi am having\b/i,
    category: "tense",
    fix: (m) => ({
      corrected: m[0]!.replace(/i am having/i, "I have"),
      explanation: 'For possession, use the simple "I have". "I am having" is only for experiences ("I am having lunch").',
    }),
  },
];

export function heuristicDetect(text: string): HeuristicHit[] {
  const hits: HeuristicHit[] = [];
  for (const h of HEURISTICS) {
    const m = text.match(h.re);
    if (m) {
      const fix = h.fix(m);
      if (fix) hits.push({ category: h.category, original: m[0], corrected: fix.corrected, explanation: fix.explanation });
    }
  }
  return hits;
}
