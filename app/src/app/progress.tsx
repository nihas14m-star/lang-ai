/**
 * Progress: skill scores, session history, mistake memory status.
 */

import React, { useState } from "react";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Screen, Card, Chip, ProgressBar, SectionTitle, EmptyState } from "../components/ui";
import { useAppStore, selectLevelSummary } from "../state/store";
import { sessionsRepo, exercisesRepo } from "../data/repos";
import { spacing, type, useTheme } from "../core/theme";
import { CEFR_DISCLAIMER, SKILLS, type Skill } from "../../../shared/src/cefr";
import { mistakeStats } from "../../../shared/src/mistakes";
import { nextObjectives } from "../../../shared/src/curriculum";

export default function Progress() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const summary = selectLevelSummary(store.profile);
  const [sessions, setSessions] = useState<Array<{ id: string; kind: string; startedAt: number }>>([]);
  const [topicStats, setTopicStats] = useState<Record<string, { correct: number; total: number }>>({});

  useFocusEffect(
    useCallback(() => {
      void sessionsRepo.recent(10).then(setSessions);
      void exercisesRepo.topicAccuracy().then(setTopicStats);
    }, []),
  );

  const { profile, mistakes } = store;
  if (!profile) return null;

  const objectives = nextObjectives({
    cefrLevel: profile.cefrLevel as never,
    mistakes,
    grammarScore: profile.skillScores.grammar,
  });

  return (
    <Screen title="Your progress" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Card>
          <Text style={styles.levelBig}>{summary?.level ?? "—"}</Text>
          <Text style={styles.levelNote}>
            estimated level · confidence {summary?.confidence ?? "low"} · {store.streak} day streak 🔥
          </Text>
          <Text style={styles.disclaimer}>{CEFR_DISCLAIMER}</Text>
        </Card>

        <SectionTitle>Skill scores</SectionTitle>
        {SKILLS.filter((s) => profile.skillScores[s as Skill] !== undefined).length === 0 ? (
          <EmptyState title="No scores yet" message="Complete the diagnostic or practice activities to build your skill profile." />
        ) : (
          SKILLS.filter((s) => profile.skillScores[s as Skill] !== undefined).map((skill) => {
            const score = profile.skillScores[skill as Skill]!;
            return (
              <Card key={skill}>
                <View style={styles.skillRow}>
                  <Text style={styles.skillName}>{skill}</Text>
                  <Chip label={`${Math.round(score)}/100`} tone={score >= 75 ? "good" : score >= 55 ? "default" : "warn"} />
                </View>
                <ProgressBar value={score / 100} accessibilityLabel={`${skill} score`} />
              </Card>
            );
          })
        )}

        <SectionTitle>Current curriculum focus</SectionTitle>
        <Card>
          {objectives.length === 0 ? (
            <Text style={styles.muted}>Keep practicing — your curriculum adapts to your results.</Text>
          ) : (
            objectives.map((o, i) => (
              <Text key={i} style={styles.objective}>{i + 1}. {o}</Text>
            ))
          )}
        </Card>

        <SectionTitle>Mistake memory</SectionTitle>
        {mistakes.length === 0 ? (
          <EmptyState title="No mistakes recorded" message="When your tutor corrects you, patterns are tracked here with accuracy over time." />
        ) : (
          mistakes.slice(0, 8).map((m) => {
            const stats = mistakeStats(m);
            return (
              <Card key={m.id}>
                <View style={styles.skillRow}>
                  <Text style={styles.skillName} numberOfLines={1}>{m.original}</Text>
                  <Chip
                    label={`${Math.round(stats.accuracy * 100)}% · ${stats.stage}`}
                    tone={stats.stage === "mastered" ? "good" : stats.stage === "explicit" ? "warn" : "default"}
                  />
                </View>
                <Text style={styles.muted}>→ {m.corrected} (seen {m.frequency}×)</Text>
              </Card>
            );
          })
        )}

        <SectionTitle>Recent sessions</SectionTitle>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" />
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
              <View style={styles.skillRow}>
                <Text style={styles.skillName}>{s.kind.replace(/_/g, " ")}</Text>
                <Text style={styles.muted}>{new Date(s.startedAt).toLocaleString()}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    levelBig: { ...type.title, fontSize: 40, color: t.primary, textAlign: "center" },
    levelNote: { ...type.small, color: t.textMuted, textAlign: "center", marginTop: 4 },
    disclaimer: { ...type.small, color: t.textMuted, fontStyle: "italic", textAlign: "center", marginTop: spacing.s },
    skillRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.s },
    skillName: { ...type.h3, color: t.text, textTransform: "capitalize", flex: 1 },
    objective: { ...type.body, color: t.text, marginBottom: spacing.xs, lineHeight: 20 },
    muted: { ...type.small, color: t.textMuted },
  });
