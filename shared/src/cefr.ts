/**
 * CEFR level system.
 * Levels: A1, A2, B1, B2, C1, C2.
 * All scoring in this product maps 0-100 skill scores onto CEFR bands.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Ordered index of a level (A1=0 ... C2=5). */
export function levelIndex(level: CefrLevel): number {
  const i = CEFR_LEVELS.indexOf(level);
  return i === -1 ? 0 : i;
}

export function clampLevel(level: CefrLevel): CefrLevel {
  return CEFR_LEVELS.includes(level) ? level : "A1";
}

/** Minimum skill score (0-100) required to be considered at a given level. */
const LEVEL_THRESHOLDS: Array<{ level: CefrLevel; min: number }> = [
  { level: "C2", min: 89 },
  { level: "C1", min: 78 },
  { level: "B2", min: 65 },
  { level: "B1", min: 50 },
  { level: "A2", min: 35 },
  { level: "A1", min: 0 },
];

/** Map a 0-100 skill score to an estimated CEFR level. */
export function scoreToLevel(score: number): CefrLevel {
  const s = Math.max(0, Math.min(100, score));
  for (const t of LEVEL_THRESHOLDS) {
    if (s >= t.min) return t.level;
  }
  return "A1";
}

/** Relative distance in levels; positive if `a` is higher than `b`. */
export function levelDistance(a: CefrLevel, b: CefrLevel): number {
  return levelIndex(a) - levelIndex(b);
}

export function nextLevel(level: CefrLevel): CefrLevel | null {
  const i = levelIndex(level);
  return i < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[i + 1]! : null;
}

export function previousLevel(level: CefrLevel): CefrLevel | null {
  const i = levelIndex(level);
  return i > 0 ? CEFR_LEVELS[i - 1]! : null;
}

export const SKILLS = [
  "grammar",
  "vocabulary",
  "speaking",
  "listening",
  "writing",
  "pronunciation",
  "fluency",
  "reading",
] as const;
export type Skill = (typeof SKILLS)[number];

export type SkillScores = Partial<Record<Skill, number>>;

/**
 * Weights used to combine per-skill scores into one overall level.
 * Weights are fixed so the estimate is explainable.
 */
const OVERALL_WEIGHTS: Partial<Record<Skill, number>> = {
  grammar: 0.2,
  vocabulary: 0.15,
  speaking: 0.2,
  listening: 0.15,
  writing: 0.12,
  fluency: 0.1,
  pronunciation: 0.04,
  reading: 0.04,
};

export interface OverallEstimate {
  score: number;
  level: CefrLevel;
  skillsMeasured: Skill[];
  confidence: "high" | "medium" | "low";
}

/**
 * Combine measured skill scores into an overall estimated CEFR level.
 * Unmeasured skills count as missing (0 contribution), NOT as perfect —
 * so sparse data drags the estimate down and confidence drops, honestly.
 */
export function estimateOverall(scores: SkillScores): OverallEstimate | null {
  let weighted = 0;
  const totalWeight = Object.values(OVERALL_WEIGHTS).reduce((a, b) => a + b, 0);
  const measured: Skill[] = [];
  for (const skill of SKILLS) {
    const w = OVERALL_WEIGHTS[skill] ?? 0;
    const score = scores[skill];
    if (score === undefined || w === 0) continue;
    weighted += score * w;
    measured.push(skill);
  }
  if (measured.length === 0) return null;
  const score = weighted / totalWeight;
  const coverage = measured.reduce((a, s) => a + (OVERALL_WEIGHTS[s] ?? 0), 0) / totalWeight;
  return {
    score,
    level: scoreToLevel(score),
    skillsMeasured: measured,
    confidence: coverage >= 0.85 ? "high" : coverage >= 0.55 ? "medium" : "low",
  };
}

/** Human-readable framing used everywhere the level is shown. */
export const CEFR_DISCLAIMER =
  "Estimated diagnostic level based on in-app practice. Not an official CEFR certification.";
