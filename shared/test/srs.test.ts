import { describe, expect, it } from "vitest";
import { isDue, newCard, qualityFromResult, review } from "../src/srs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe("SM-2 spaced repetition", () => {
  it("schedules first successful review to tomorrow, then 3 days", () => {
    let card = newCard(NOW);
    card = review(card, 4, NOW);
    expect(card.intervalDays).toBe(1);
    expect(card.repetitions).toBe(1);
    expect(card.dueAt).toBe(NOW + 1 * DAY);

    card = review(card, 4, NOW + DAY);
    expect(card.intervalDays).toBe(3);
    expect(card.dueAt).toBe(NOW + DAY + 3 * DAY);
  });

  it("grows intervals by ease factor", () => {
    let card = newCard(NOW);
    card = review(card, 5, NOW); // 1 day
    card = review(card, 5, NOW + DAY); // 3 days
    card = review(card, 5, NOW + 4 * DAY); // 3*2.6≈8
    expect(card.intervalDays).toBeGreaterThanOrEqual(7);
    expect(card.intervalDays).toBeLessThanOrEqual(9);
    expect(card.ease).toBeGreaterThan(2.5);
  });

  it("resets progress on failure and counts a lapse", () => {
    let card = newCard(NOW);
    card = review(card, 5, NOW);
    card = review(card, 5, NOW + DAY);
    const before = card;
    card = review(card, 1, NOW + 5 * DAY);
    expect(card.repetitions).toBe(0);
    expect(card.intervalDays).toBe(1);
    expect(card.lapses).toBe(before.lapses + 1);
    expect(card.ease).toBeLessThan(before.ease);
  });

  it("clamps quality input", () => {
    let card = newCard(NOW);
    card = review(card, 99, NOW);
    expect(card.repetitions).toBe(1);
    card = review(card, -10, NOW);
    expect(card.repetitions).toBe(0);
  });

  it("isDue works", () => {
    const card = review(newCard(NOW), 4, NOW);
    expect(isDue(card, NOW + 2 * DAY)).toBe(true);
    expect(isDue(card, NOW)).toBe(false);
  });

  it("maps mastery+result to sensible quality", () => {
    expect(qualityFromResult(0.9, true)).toBe(5);
    expect(qualityFromResult(0.3, true)).toBe(4);
    expect(qualityFromResult(0.9, false)).toBe(2);
    expect(qualityFromResult(0.2, false)).toBe(1);
  });
});
