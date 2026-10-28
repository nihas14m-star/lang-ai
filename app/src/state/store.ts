/**
 * Global app state (zustand). Bridges the DB repos, the shared learning
 * engine, and the UI. Screens stay presentational; all mutations flow
 * through these actions.
 */

import { create } from "zustand";
import type { LearnerSnapshotT, CorrectionT, VocabItemT, ScenarioDescriptorT, ChatTurnT } from "../../../shared/src/contracts";
import type { DailyMission } from "../../../shared/src/mission";
import { generateDailyMission } from "../../../shared/src/mission";
import { estimateOverall, type SkillScores, type Skill } from "../../../shared/src/cefr";
import { updateSkillScore } from "../../../shared/src/scoring";
import { mistakeStats } from "../../../shared/src/mistakes";
import type { DiagnosticResult } from "../../../shared/src/assessment";
import { api, ApiError } from "../core/api";
import { profileRepo, mistakesRepo, vocabRepo, missionsRepo, exercisesRepo, applySkillUpdates, type ProfileRow } from "../data/repos";
import type { MistakeRecord } from "../../../shared/src/mistakes";
import type { VocabRow } from "../data/repos";

export type ConnectionState = "checking" | "online" | "offline" | "degraded";

function dateKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AppState {
  ready: boolean;
  profile: ProfileRow | null;
  mistakes: MistakeRecord[];
  vocabCount: number;
  mission: DailyMission | null;
  missionCompleted: string[];
  streak: number;
  connection: ConnectionState;
  backendProvider: string | null;
  lastError: string | null;

  bootstrap: () => Promise<void>;
  checkConnection: () => Promise<void>;
  createProfile: (input: { name: string; nativeLanguage: string; goals: string[]; dailyGoalMinutes: number; targetLevel: string }) => Promise<void>;
  saveDiagnostic: (result: DiagnosticResult) => Promise<void>;
  refreshMission: () => Promise<void>;
  completeMissionActivity: (index: number) => Promise<void>;
  recordSkillResult: (input: { skill: Skill; correct: boolean; quality?: number; difficulty: string; kind: string; refId?: string; topicId?: string }) => Promise<void>;
  recordCorrections: (corrections: CorrectionT[], context: string) => Promise<void>;
  recordVocabulary: (items: VocabItemT[]) => Promise<void>;
  snapshot: () => Promise<LearnerSnapshotT>;
  refreshData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  profile: null,
  mistakes: [],
  vocabCount: 0,
  mission: null,
  missionCompleted: [],
  streak: 0,
  connection: "checking",
  backendProvider: null,
  lastError: null,

  async bootstrap() {
    try {
      const profile = await profileRepo.get();
      const mistakes = await mistakesRepo.all();
      const vocabCount = await vocabRepo.count();
      set({ profile, mistakes, vocabCount, ready: true });
      await get().refreshMission();
    } catch (err) {
      set({ ready: true, lastError: err instanceof Error ? err.message : "Failed to load local data" });
    }
  },

  async checkConnection() {
    set({ connection: "checking" });
    try {
      const health = await api.health();
      const aiProvider = health.providers.find((p) => p.isDefault);
      const degraded = aiProvider?.name === "mock";
      set({
        connection: degraded ? "degraded" : "online",
        backendProvider: aiProvider?.name ?? null,
      });
    } catch (err) {
      set({
        connection: "offline",
        backendProvider: null,
        lastError: err instanceof ApiError ? err.message : "Tutor service unreachable",
      });
    }
  },

  async createProfile(input) {
    await profileRepo.create(input);
    const profile = await profileRepo.get();
    set({ profile });
  },

  async saveDiagnostic(result) {
    const level = result.overall?.level ?? "A1";
    await profileRepo.updateDiagnostic(result, level);
    const profile = await profileRepo.get();
    set({ profile });
    await get().refreshMission();
  },

  async refreshMission() {
    const { profile } = get();
    if (!profile) return;
    const dateKey = dateKeyNow();
    const existing = await missionsRepo.get(dateKey);
    if (existing) {
      set({ mission: existing.plan, missionCompleted: existing.completed });
      const streak = await missionsRepo.streak();
      set({ streak: streak.current });
      return;
    }
    const dueVocab = await vocabRepo.due(50);
    const dueMistakes = await mistakesRepo.due(20);
    const plan = generateDailyMission({
      cefrLevel: profile.cefrLevel as LearnerSnapshotT["cefrLevel"],
      dailyGoalMinutes: profile.dailyGoalMinutes,
      dueVocabCount: dueVocab.length,
      dueMistakes,
      mistakes: await mistakesRepo.all(),
      scenarioIds: ["introductions", "casual_smalltalk", "ordering_food", "college_daily", "travel_airport"],
      now: Date.now(),
      dateKey,
    });
    await missionsRepo.save(plan, []);
    set({ mission: plan, missionCompleted: [] });
    const streak = await missionsRepo.streak();
    set({ streak: streak.current });
  },

  async completeMissionActivity(index) {
    const { mission, missionCompleted } = get();
    if (!mission) return;
    const activityId = `${index}`;
    if (!missionCompleted.includes(activityId)) {
      const next = [...missionCompleted, activityId];
      await missionsRepo.save(mission, next);
      set({ missionCompleted: next });
    }
  },

  async recordSkillResult(input) {
    const { profile } = get();
    if (!profile) return;
    await exercisesRepo.record({
      kind: input.kind, refId: input.refId, topicId: input.topicId,
      correct: input.correct, quality: input.quality, difficulty: input.difficulty, skill: input.skill,
    });
    await applySkillUpdates(profile, [{ skill: input.skill, correct: input.correct, quality: input.quality }], input.difficulty);
    const updated = await profileRepo.get();
    set({ profile: updated });
  },

  async recordCorrections(corrections, context) {
    for (const c of corrections) {
      await mistakesRepo.record(c, context);
    }
    set({ mistakes: await mistakesRepo.all() });
  },

  async recordVocabulary(items) {
    for (const item of items) {
      await vocabRepo.upsert(item);
    }
    set({ vocabCount: await vocabRepo.count() });
  },

  async snapshot() {
    const { profile, mistakes } = get();
    if (!profile) {
      throw new Error("Profile missing");
    }
    const vocab = await vocabRepo.all();
    const { LearnerSnapshotSchema } = await import("../../../shared/src/contracts");
    return LearnerSnapshotSchema.parse({
      name: profile.name || "Learner",
      nativeLanguage: profile.nativeLanguage || "unknown",
      cefrLevel: profile.cefrLevel,
      goals: profile.goals,
      skillScores: profile.skillScores,
      weakAreas: (Object.entries(profile.skillScores) as Array<[Skill, number]>)
        .filter(([, v]) => v < 55).map(([k]) => k),
      activeMistakes: mistakes.slice(0, 12).map((m) => ({
        category: m.category,
        original: m.original,
        corrected: m.corrected,
        frequency: m.frequency,
        stage: mistakeStats(m).stage,
      })),
      knownVocabulary: vocab.slice(0, 60).map((v) => v.word),
    }) as LearnerSnapshotT;
  },

  async refreshData() {
    set({
      mistakes: await mistakesRepo.all(),
      vocabCount: await vocabRepo.count(),
    });
  },
}));

/** Convenience selector: current estimated level info. */
export function selectLevelSummary(profile: ProfileRow | null) {
  if (!profile) return null;
  const est = estimateOverall(profile.skillScores);
  return {
    level: (est?.level ?? profile.cefrLevel) as string,
    confidence: est?.confidence ?? "low",
    scores: profile.skillScores as SkillScores,
  };
}
