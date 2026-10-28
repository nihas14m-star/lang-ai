/**
 * Skill scoring.
 * Scores live in [0, 100] and are derived ONLY from observable exercise
 * results and evaluations. The AI never invents scores; it only supplies
 * correctness/quality judgments for specific responses, which are fed here.
 */

import type { CefrLevel, Skill, SkillScores } from "./cefr";
import { levelIndex } from "./cefr";

export interface SkillUpdate {
  skill: Skill;
  correct: boolean;
  /** 0-1 quality of the response when partially correct. Default: correct ? 1 : 0.25 */
  quality?: number;
  /** CEFR difficulty of the exercise the learner attempted. */
  difficulty: CefrLevel;
  /** Relative importance of this observation (default 1). */
  weight?: number;
}

/** Learning rate: early scores move fast, then stabilize. */
function alpha(currentScore: number | undefined): number {
  return currentScore === undefined ? 0.5 : 0.18;
}

/**
 * Difficulty-adjusted EMA update.
 * - Correct at a difficulty above current level => larger gain.
 * - Incorrect at a difficulty well below level => larger drop.
 * `weight` > 1 makes the observation move the score more (e.g., a full session).
 */
export function updateSkillScore(
  scores: SkillScores,
  update: SkillUpdate,
): SkillScores {
  const current = scores[update.skill];
  const q = update.quality ?? (update.correct ? 1 : 0.25);
  const target = update.correct ? 65 + q * 35 : Math.max(0, 25 * q);
  const diff = levelIndex(update.difficulty);
  const bonus = (diff - 1) * 2; // A1 exercises neutral, B2 adds ~+2 etc.
  const effective = Math.max(0, Math.min(100, target + (update.correct ? bonus : -bonus)));
  const a = alpha(current) * Math.min(3, Math.max(0.5, update.weight ?? 1));
  const next = current === undefined
    ? effective
    : current + (effective - current) * Math.min(1, a);
  return { ...scores, [update.skill]: Math.max(0, Math.min(100, next)) };
}

/** A skill is considered "mastered" for curriculum purposes at this score. */
export const MASTERY_THRESHOLD = 75;

/** A skill is a "weak area" below this score. */
export const WEAK_THRESHOLD = 55;

export function strengths(scores: SkillScores): Skill[] {
  return (Object.entries(scores) as Array<[Skill, number]>)
    .filter(([, v]) => v >= MASTERY_THRESHOLD)
    .map(([k]) => k)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
}

export function weakAreas(scores: SkillScores): Skill[] {
  return (Object.entries(scores) as Array<[Skill, number]>)
    .filter(([, v]) => v < WEAK_THRESHOLD)
    .map(([k]) => k)
    .sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
}

/**
 * Progress toward the next CEFR level (0-1), used for progress UI.
 */
export function progressToNextLevel(scores: SkillScores, currentLevel: CefrLevel): number {
  const THRESHOLDS: Record<CefrLevel, number> = {
    A1: 35, A2: 50, B1: 65, B2: 78, C1: 89, C2: 100,
  };
  const current = Object.values(scores).filter((v): v is number => v !== undefined);
  if (current.length === 0) return 0;
  const avg = current.reduce((a, b) => a + b, 0) / current.length;
  const floor = THRESHOLDS[currentLevel];
  const ceiling = THRESHOLDS[
    (Object.keys(THRESHOLDS) as CefrLevel[]).find((k) => THRESHOLDS[k]! > floor) ?? "C2"
  ] ?? 100;
  if (ceiling <= floor) return 1;
  return Math.max(0, Math.min(1, (avg - floor) / (ceiling - floor)));
}
