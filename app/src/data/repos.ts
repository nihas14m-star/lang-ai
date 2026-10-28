/**
 * Repositories: typed access to the local database.
 */

import { openDb, type Db } from "./db";
import {
  newCard, review, isDue, qualityFromResult, type SrsCard,
} from "../../../shared/src/srs";
import {
  updateSkillScore, strengths as computeStrengths, weakAreas as computeWeak,
  type SkillUpdate,
} from "../../../shared/src/scoring";
import { mistakeStats, mergeMistake, type MistakeRecord, type MistakeCategory } from "../../../shared/src/mistakes";
import type { SkillScores, Skill } from "../../../shared/src/cefr";
import type { CorrectionT, VocabItemT, ScenarioDescriptorT, ChatTurnT } from "../../../shared/src/contracts";
import type { MissionActivity, DailyMission } from "../../../shared/src/mission";
import type { DiagnosticResult } from "../../../shared/src/assessment";

const now = () => Date.now();

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ---------------- Profile ----------------

export interface ProfileRow {
  name: string;
  nativeLanguage: string;
  goals: string[];
  dailyGoalMinutes: number;
  cefrLevel: string;
  targetLevel: string;
  skillScores: SkillScores;
  onboarded: boolean;
  diagnostic: DiagnosticResult | null;
  createdAt: number;
  updatedAt: number;
}

export const profileRepo = {
  async get(): Promise<ProfileRow | null> {
    const db = await openDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM profile WHERE id = 1",
    );
    if (!row) return null;
    return {
      name: String(row.name ?? ""),
      nativeLanguage: String(row.native_language ?? ""),
      goals: parse<string[]>(row.goals_json as string, []),
      dailyGoalMinutes: Number(row.daily_goal_minutes ?? 15),
      cefrLevel: String(row.cefr_level ?? "A1"),
      targetLevel: String(row.target_level ?? "B2"),
      skillScores: parse<SkillScores>(row.skill_scores_json as string, {}),
      onboarded: Number(row.onboarded ?? 0) === 1,
      diagnostic: parse<DiagnosticResult | null>(row.diagnostic_json as string, null),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  },

  async create(input: {
    name: string; nativeLanguage: string; goals: string[]; dailyGoalMinutes: number; targetLevel: string;
  }): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO profile (id, name, native_language, goals_json, daily_goal_minutes, cefr_level, target_level, skill_scores_json, onboarded, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, 'A1', ?, '{}', 1, ?, ?)`,
      input.name, input.nativeLanguage, JSON.stringify(input.goals),
      input.dailyGoalMinutes, input.targetLevel, now(), now(),
    );
  },

  async updateLevel(cefrLevel: string): Promise<void> {
    const db = await openDb();
    await db.runAsync("UPDATE profile SET cefr_level = ?, updated_at = ? WHERE id = 1", cefrLevel, now());
  },

  async updateDiagnostic(result: DiagnosticResult, level: string): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "UPDATE profile SET diagnostic_json = ?, cefr_level = ?, skill_scores_json = ?, updated_at = ? WHERE id = 1",
      JSON.stringify(result), level, JSON.stringify(result.skillScores), now(),
    );
  },

  async updateSkillScores(scores: SkillScores): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "UPDATE profile SET skill_scores_json = ?, updated_at = ? WHERE id = 1",
      JSON.stringify(scores), now(),
    );
  },

  async updatePreferences(input: { dailyGoalMinutes?: number; targetLevel?: string; name?: string }): Promise<void> {
    const db = await openDb();
    const current = await profileRepo.get();
    if (!current) return;
    await db.runAsync(
      "UPDATE profile SET daily_goal_minutes = ?, target_level = ?, name = ?, updated_at = ? WHERE id = 1",
      input.dailyGoalMinutes ?? current.dailyGoalMinutes,
      input.targetLevel ?? current.targetLevel,
      input.name ?? current.name,
      now(),
    );
  },
};

// ---------------- Mistakes ----------------

function rowToMistake(row: Record<string, unknown>): MistakeRecord {
  return {
    id: String(row.id),
    category: String(row.category) as MistakeCategory,
    original: String(row.original),
    corrected: String(row.corrected),
    explanation: String(row.explanation ?? ""),
    context: String(row.context ?? ""),
    frequency: Number(row.frequency ?? 1),
    correctCount: Number(row.correct_count ?? 0),
    confidence: Number(row.confidence ?? 60),
    firstSeenAt: Number(row.first_seen_at ?? 0),
    lastSeenAt: Number(row.last_seen_at ?? 0),
    srs: parse<SrsCard>(row.srs_json as string, newCard(0)),
  };
}

export const mistakesRepo = {
  async all(): Promise<MistakeRecord[]> {
    const db = await openDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM mistakes ORDER BY last_seen_at DESC LIMIT 300",
    );
    return rows.map(rowToMistake);
  },

  async due(limit = 10, at = now()): Promise<MistakeRecord[]> {
    const all = await mistakesRepo.all();
    return all
      .filter((m) => isDue(m.srs, at) && (m.srs.repetitions > 0 || m.srs.lapses > 0))
      .slice(0, limit);
  },

  /** Record a correction from the tutor. */
  async record(correction: CorrectionT, context: string): Promise<void> {
    const db = await openDb();
    const existingRow = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM mistakes WHERE category = ? AND LOWER(original) = LOWER(?)",
      correction.category, correction.original,
    );
    const existing = existingRow ? rowToMistake(existingRow) : undefined;
    const merged = mergeMistake(existing, {
      category: correction.category,
      original: correction.original,
      corrected: correction.corrected,
      explanation: correction.explanation,
      context,
    }, now());
    await db.runAsync(
      `INSERT OR REPLACE INTO mistakes
       (id, category, original, corrected, explanation, context, frequency, correct_count, confidence, first_seen_at, last_seen_at, srs_json, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      merged.id, merged.category, merged.original, merged.corrected, merged.explanation,
      merged.context, merged.frequency, merged.correctCount, merged.confidence,
      merged.firstSeenAt, merged.lastSeenAt, JSON.stringify(merged.srs),
    );
  },

  /** Learner answered a mistake-review correctly/incorrectly. */
  async reviewResult(mistakeId: string, correct: boolean): Promise<void> {
    const db = await openDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM mistakes WHERE id = ?", mistakeId,
    );
    if (!row) return;
    const m = rowToMistake(row);
    if (correct) m.correctCount += 1;
    const stats = mistakeStats(m);
    const quality = qualityFromResult(stats.accuracy, correct);
    const nextSrs = review(m.srs, quality, now());
    await db.runAsync(
      "UPDATE mistakes SET correct_count = ?, srs_json = ?, last_seen_at = ? WHERE id = ?",
      m.correctCount, JSON.stringify(nextSrs), now(), mistakeId,
    );
  },
};

// ---------------- Vocabulary ----------------

export interface VocabRow {
  word: string;
  meaning: string;
  partOfSpeech?: string;
  pronunciation?: string;
  example?: string;
  synonyms: string[];
  difficulty?: string;
  firstSeen: number;
  lastReviewed?: number;
  reviewCount: number;
  mastery: number;
  srs: SrsCard;
  source: string;
}

function rowToVocab(row: Record<string, unknown>): VocabRow {
  return {
    word: String(row.word),
    meaning: String(row.meaning),
    partOfSpeech: row.part_of_speech ? String(row.part_of_speech) : undefined,
    pronunciation: row.pronunciation ? String(row.pronunciation) : undefined,
    example: row.example ? String(row.example) : undefined,
    synonyms: parse<string[]>(row.synonyms_json as string, []),
    difficulty: row.difficulty ? String(row.difficulty) : undefined,
    firstSeen: Number(row.first_seen ?? 0),
    lastReviewed: row.last_reviewed ? Number(row.last_reviewed) : undefined,
    reviewCount: Number(row.review_count ?? 0),
    mastery: Number(row.mastery ?? 0),
    srs: parse<SrsCard>(row.srs_json as string, newCard(0)),
    source: String(row.source ?? "conversation"),
  };
}

export const vocabRepo = {
  async all(): Promise<VocabRow[]> {
    const db = await openDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM vocabulary ORDER BY first_seen DESC LIMIT 500",
    );
    return rows.map(rowToVocab);
  },

  async due(limit = 10, at = now()): Promise<VocabRow[]> {
    const all = await vocabRepo.all();
    return all.filter((v) => isDue(v.srs, at)).slice(0, limit);
  },

  async upsert(item: VocabItemT, source = "conversation"): Promise<void> {
    const db = await openDb();
    const word = item.word.toLowerCase().trim();
    const existing = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM vocabulary WHERE word = ?", word,
    );
    if (existing) {
      await db.runAsync(
        "UPDATE vocabulary SET last_reviewed = last_reviewed WHERE word = ?",
        word,
      );
      return; // already tracked; don't reset SRS progress
    }
    const card = newCard(now());
    card.dueAt = now() + 24 * 60 * 60 * 1000; // first review tomorrow
    await db.runAsync(
      `INSERT OR REPLACE INTO vocabulary
       (word, meaning, part_of_speech, pronunciation, example, synonyms_json, difficulty, first_seen, review_count, mastery, srs_json, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      word, item.meaning, item.partOfSpeech ?? null, item.pronunciation ?? null,
      item.example ?? null, JSON.stringify(item.synonyms ?? []), item.difficulty ?? null,
      now(), JSON.stringify(card), source,
    );
  },

  async reviewResult(word: string, correct: boolean): Promise<void> {
    const db = await openDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM vocabulary WHERE word = ?", word,
    );
    if (!row) return;
    const v = rowToVocab(row);
    const quality = qualityFromResult(v.mastery, correct);
    const nextSrs = review(v.srs, quality, now());
    const mastery = Math.max(0, Math.min(1, v.mastery + (correct ? 0.2 : -0.15)));
    await db.runAsync(
      "UPDATE vocabulary SET srs_json = ?, mastery = ?, review_count = review_count + 1, last_reviewed = ? WHERE word = ?",
      JSON.stringify(nextSrs), mastery, now(), word,
    );
  },

  async count(): Promise<number> {
    const db = await openDb();
    const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM vocabulary");
    return row?.c ?? 0;
  },

  async delete(word: string): Promise<void> {
    const db = await openDb();
    await db.runAsync("DELETE FROM vocabulary WHERE word = ?", word);
  },
};

// ---------------- Sessions & messages ----------------

export const sessionsRepo = {
  async start(kind: string, scenarioId?: string, id?: string): Promise<string> {
    const db = await openDb();
    const sessionId = id ?? `s_${now()}_${Math.floor(Math.random() * 1e6)}`;
    await db.runAsync(
      "INSERT OR REPLACE INTO sessions (id, kind, scenario_id, started_at) VALUES (?, ?, ?, ?)",
      sessionId, kind, scenarioId ?? null, now(),
    );
    return sessionId;
  },

  async end(sessionId: string, summary?: unknown): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "UPDATE sessions SET ended_at = ?, summary_json = ? WHERE id = ?",
      now(), summary ? JSON.stringify(summary) : null, sessionId,
    );
  },

  async recent(limit = 20): Promise<Array<{ id: string; kind: string; scenarioId?: string; startedAt: number; endedAt?: number }>> {
    const db = await openDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?", limit,
    );
    return rows.map((r) => ({
      id: String(r.id),
      kind: String(r.kind),
      scenarioId: r.scenario_id ? String(r.scenario_id) : undefined,
      startedAt: Number(r.started_at),
      endedAt: r.ended_at ? Number(r.ended_at) : undefined,
    }));
  },

  async addMessage(sessionId: string, role: "user" | "tutor", content: string, corrections: CorrectionT[] = [], vocabulary: VocabItemT[] = []): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "INSERT INTO messages (session_id, role, content, corrections_json, vocabulary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      sessionId, role, content, JSON.stringify(corrections), JSON.stringify(vocabulary), now(),
    );
  },

  async messages(sessionId: string, limit = 100): Promise<Array<ChatTurnT & { corrections: CorrectionT[]; vocabulary: VocabItemT[] }>> {
    const db = await openDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC LIMIT ?", sessionId, limit,
    );
    return rows.map((r) => ({
      role: String(r.role) as "user" | "tutor",
      content: String(r.content),
      corrections: parse<CorrectionT[]>(r.corrections_json as string, []),
      vocabulary: parse<VocabItemT[]>(r.vocabulary_json as string, []),
    }));
  },
};

// ---------------- Exercise results ----------------

export const exercisesRepo = {
  async record(input: { kind: string; refId?: string; topicId?: string; correct: boolean; quality?: number; difficulty: string; skill: Skill }): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "INSERT INTO exercise_results (kind, ref_id, topic_id, correct, quality, difficulty, skill, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      input.kind, input.refId ?? "", input.topicId ?? "", input.correct ? 1 : 0,
      input.quality ?? (input.correct ? 1 : 0.25), input.difficulty, input.skill, now(),
    );
  },

  /** Recent accuracy per topic (for curriculum signals). */
  async topicAccuracy(): Promise<Record<string, { correct: number; total: number }>> {
    const db = await openDb();
    const rows = await db.getAllAsync<{ topic_id: string; c: number; t: number }>(
      `SELECT topic_id, SUM(correct) as c, COUNT(*) as t FROM exercise_results
       WHERE topic_id != '' GROUP BY topic_id ORDER BY MAX(created_at) DESC LIMIT 50`,
    );
    const out: Record<string, { correct: number; total: number }> = {};
    for (const r of rows) out[r.topic_id] = { correct: r.c, total: r.t };
    return out;
  },
};

// ---------------- Mission log ----------------

export const missionsRepo = {
  async get(dateKey: string): Promise<{ plan: DailyMission; completed: string[] } | null> {
    const db = await openDb();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM mission_log WHERE date_key = ?", dateKey,
    );
    if (!row) return null;
    return {
      plan: parse<DailyMission>(row.plan_json as string, { dateKey, totalMinutes: 0, activities: [], focusNote: "" }),
      completed: parse<string[]>(row.completed_json as string, []),
    };
  },

  async save(plan: DailyMission, completed: string[]): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      "INSERT OR REPLACE INTO mission_log (date_key, plan_json, completed_json, updated_at) VALUES (?, ?, ?, ?)",
      plan.dateKey, JSON.stringify(plan), JSON.stringify(completed), now(),
    );
  },

  async streak(): Promise<{ current: number; best: number }> {
    const db = await openDb();
    const rows = await db.getAllAsync<{ date_key: string; completed_json: string }>(
      "SELECT date_key, completed_json FROM mission_log ORDER BY date_key DESC LIMIT 120",
    );
    const day = 86_400_000;
    const parseKey = (key: string): number => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y!, (m ?? 1) - 1, d).setHours(0, 0, 0, 0);
    };
    const active = rows.filter((r) => parse<string[]>(r.completed_json, []).length > 0);
    if (active.length === 0) return { current: 0, best: 0 };

    // Current streak: consecutive active days ending today (or yesterday).
    const today = new Date().setHours(0, 0, 0, 0);
    let current = 0;
    const activeDays = new Set(active.map((r) => parseKey(r.date_key)));
    let cursor = today;
    if (!activeDays.has(cursor)) cursor -= day; // streak survives if yesterday was done
    while (activeDays.has(cursor)) {
      current++;
      cursor -= day;
    }

    // Best streak: longest run of consecutive active days.
    const sorted = [...activeDays].sort((a, b) => a - b);
    let best = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]! - sorted[i - 1]! === day) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 1;
      }
    }
    return { current, best };
  },
};

// ---------------- Learner snapshot (sent to backend, ephemeral) ----------------

export async function buildLearnerSnapshot(
  profile: ProfileRow,
  mistakes: MistakeRecord[],
  knownVocab: string[],
): Promise<import("../../../shared/src/contracts").LearnerSnapshotT> {
  const { LearnerSnapshotSchema } = await import("../../../shared/src/contracts");
  return LearnerSnapshotSchema.parse({
    name: profile.name || "Learner",
    nativeLanguage: profile.nativeLanguage || "unknown",
    cefrLevel: profile.cefrLevel,
    goals: profile.goals,
    skillScores: profile.skillScores,
    weakAreas: computeWeak(profile.skillScores),
    activeMistakes: mistakes.slice(0, 12).map((m) => ({
      category: m.category,
      original: m.original,
      corrected: m.corrected,
      frequency: m.frequency,
      stage: mistakeStats(m).stage,
    })),
    knownVocabulary: knownVocab.slice(0, 60),
  });
}

/** Apply skill updates from an evaluation to the profile. */
export async function applySkillUpdates(
  profile: ProfileRow,
  updates: Array<{ skill: Skill; correct: boolean; quality?: number }>,
  difficulty: string,
): Promise<SkillScores> {
  let scores = profile.skillScores;
  for (const u of updates) {
    scores = updateSkillScore(scores, {
      skill: u.skill, correct: u.correct, quality: u.quality,
      difficulty: difficulty as SkillUpdate["difficulty"],
    });
  }
  await profileRepo.updateSkillScores(scores);
  return scores;
}
