/**
 * Spaced repetition (SM-2 inspired) for vocabulary and mistake reviews.
 * Pure functions; timestamps are epoch millis.
 */

export interface SrsCard {
  /** Number of consecutive successful reviews. */
  repetitions: number;
  /** Ease factor; lower = harder item. */
  ease: number;
  /** Current review interval in days. */
  intervalDays: number;
  /** Next due timestamp (epoch ms). */
  dueAt: number;
  /** Total lapses (failed reviews after having progressed). */
  lapses: number;
}

export function newCard(now: number): SrsCard {
  return { repetitions: 0, ease: 2.5, intervalDays: 0, dueAt: now, lapses: 0 };
}

/** Initial intervals after each successful review (days). */
const FIRST_INTERVALS = [1, 3] as const;
const MAX_INTERVAL_DAYS = 180;
const MIN_EASE = 1.3;

/**
 * Apply a review.
 * @param quality 0-5 recall quality (>=3 counts as remembered).
 */
export function review(card: SrsCard, quality: number, now: number): SrsCard {
  const q = Math.max(0, Math.min(5, quality));
  if (q < 3) {
    return {
      repetitions: 0,
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      intervalDays: 1,
      dueAt: now + 1 * 24 * 60 * 60 * 1000,
      lapses: card.lapses + 1,
    };
  }
  let ease = card.ease;
  if (q >= 3) ease += 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  ease = Math.max(MIN_EASE, Math.min(3.0, ease));

  let intervalDays: number;
  if (card.repetitions === 0) intervalDays = FIRST_INTERVALS[0];
  else if (card.repetitions === 1) intervalDays = FIRST_INTERVALS[1];
  else intervalDays = Math.round(card.intervalDays * ease);

  intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays));
  return {
    repetitions: card.repetitions + 1,
    ease,
    intervalDays,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
    lapses: card.lapses,
  };
}

export function isDue(card: SrsCard, now: number): boolean {
  return card.dueAt <= now;
}

/**
 * Map a mastery value (0-1) and a correct/incorrect result to an SM-2 quality.
 * Used so callers can persist mastery without knowing SM-2 internals.
 */
export function qualityFromResult(mastery: number, correct: boolean): number {
  if (correct) return mastery > 0.8 ? 5 : 4;
  return mastery > 0.6 ? 2 : 1;
}
