/**
 * Home: today's mission, level, streak, and the activity hub.
 */

import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Screen, Card, SectionTitle, ProgressBar, Chip, Banner, Center } from "../components/ui";
import { useAppStore, selectLevelSummary } from "../state/store";
import { spacing, type, useTheme } from "../core/theme";
import { CEFR_DISCLAIMER } from "../../../shared/src/cefr";
import { progressToNextLevel } from "../../../shared/src/scoring";
import type { MissionActivity } from "../../../shared/src/mission";

const ACTIVITY_ROUTES: Record<MissionActivity["kind"], string> = {
  vocabulary_review: "/review",
  mistake_review: "/review",
  grammar_drill: "/grammar",
  speaking: "/speaking",
  conversation: "/conversation",
  listening: "/listening",
  writing: "/writing",
};

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { profile, mission, missionCompleted, streak, connection, ready } = useAppStore();
  const refreshMission = useAppStore((s) => s.refreshMission);
  const checkConnection = useAppStore((s) => s.checkConnection);
  const summary = selectLevelSummary(profile);

  useFocusEffect(
    useCallback(() => {
      void refreshMission();
      void checkConnection();
    }, [refreshMission, checkConnection]),
  );

  useEffect(() => {
    if (ready && !profile) {
      router.replace("/onboarding");
    }
  }, [ready, profile, router]);

  if (!profile) {
    return (
      <Screen title="English Tutor AI" scroll={false}>
        <Center>
          <Text style={{ ...type.body, color: theme.textMuted }}>Setting things up…</Text>
        </Center>
      </Screen>
    );
  }

  const dueBadge = useAppStore.getState().vocabCount > 0;
  const minutesDone = mission
    ? mission.activities.filter((_, i) => missionCompleted.includes(`${i}`)).reduce((a, x) => a + x.minutes, 0)
    : 0;
  const missionProgress = mission && mission.totalMinutes > 0 ? minutesDone / mission.totalMinutes : 0;

  return (
    <Screen title={`Hi, ${profile.name || "there"} 👋`} subtitle="Let's improve your English today">
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {connection === "offline" && (
          <Banner tone="warn">Offline — practice continues with built-in exercises. Connect to unlock your AI tutor.</Banner>
        )}
        {connection === "degraded" && (
          <Banner tone="info">Tutor service is running without an AI key — using the built-in rule-based tutor. Set NVIDIA_API_KEY on the backend for full AI feedback.</Banner>
        )}

        {/* Level card */}
        <Card>
          <View style={styles.levelRow}>
            <View>
              <Text style={styles.levelLabel}>Estimated level</Text>
              <Text style={styles.levelValue}>{summary?.level ?? "—"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.levelLabel}>Streak</Text>
              <Text style={styles.levelValue}>{streak} 🔥</Text>
            </View>
          </View>
          <ProgressBar
            value={progressToNextLevel(profile.skillScores, (profile.cefrLevel as "A1"))}
            accessibilityLabel="Progress to next CEFR level"
          />
          <Text style={styles.disclaimer}>{CEFR_DISCLAIMER}</Text>
        </Card>

        {/* Today's mission */}
        <SectionTitle
          action={
            mission ? (
              <Chip label={`${minutesDone}/${mission.totalMinutes} min`} tone={minutesDone >= mission.totalMinutes ? "good" : "default"} />
            ) : undefined
          }
        >
          Today's practice
        </SectionTitle>
        {mission?.focusNote ? <Text style={styles.focusNote}>{mission.focusNote}</Text> : null}
        {mission?.activities.map((activity, index) => {
          const done = missionCompleted.includes(`${index}`);
          return (
            <Card
              key={`${activity.kind}-${index}`}
              onPress={() => {
                const route = ACTIVITY_ROUTES[activity.kind];
                if (route) router.push(route as never);
              }}
              accessibilityLabel={`Start ${activity.title}`}
              style={done ? { opacity: 0.65 } : undefined}
            >
              <View style={styles.activityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>
                    {done ? "✓ " : ""}{activity.title}
                  </Text>
                  <Text style={styles.activityDesc}>{activity.description}</Text>
                </View>
                <Chip label={`${activity.minutes} min`} tone={done ? "good" : "default"} />
              </View>
            </Card>
          );
        })}

        {/* Activity hub */}
        <SectionTitle>Practice anything</SectionTitle>
        <View style={styles.hubGrid}>
          {[
            { route: "/conversation", title: "Talk", desc: "Scenarios with your tutor", icon: "💬" },
            { route: "/speaking", title: "Speak", desc: "Fluency + feedback", icon: "🎤" },
            { route: "/grammar", title: "Grammar", desc: "Targeted drills", icon: "🧩" },
            { route: "/vocabulary", title: "Vocabulary", desc: dueBadge ? "New words saved" : "Your words", icon: "📚" },
            { route: "/review", title: "Review", desc: "Spaced repetition", icon: "🔁" },
            { route: "/listening", title: "Listen", desc: "Train your ear", icon: "🎧" },
            { route: "/writing", title: "Write", desc: "Get line-by-line feedback", icon: "✍️" },
            { route: "/interview", title: "Interview", desc: "Mock interviews", icon: "🧑‍💼" },
            { route: "/pronunciation", title: "Pronounce", desc: "Practice tricky words", icon: "🗣" },
            { route: "/diagnostic", title: "Assessment", desc: "Re-check your level", icon: "🎯" },
            { route: "/progress", title: "Progress", desc: "Scores and history", icon: "📈" },
            { route: "/profile", title: "Profile", desc: "Settings & privacy", icon: "⚙️" },
          ].map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as never)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={styles.hubCard}
            >
              <Text style={styles.hubIcon}>{item.icon}</Text>
              <Text style={styles.hubTitle}>{item.title}</Text>
              <Text style={styles.hubDesc}>{item.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    levelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.m },
    levelLabel: { ...type.small, color: t.textMuted },
    levelValue: { ...type.title, color: t.primary },
    disclaimer: { ...type.small, color: t.textMuted, marginTop: spacing.m, fontStyle: "italic" },
    focusNote: { ...type.small, color: t.accent, marginBottom: spacing.m },
    activityRow: { flexDirection: "row", alignItems: "center", gap: spacing.m },
    activityTitle: { ...type.h3, color: t.text },
    activityDesc: { ...type.small, color: t.textMuted, marginTop: 2 },
    hubGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.m },
    hubCard: {
      width: "31%", flexGrow: 1, backgroundColor: t.surface, borderRadius: 12,
      padding: spacing.m, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
    },
    hubIcon: { fontSize: 22 },
    hubTitle: { ...type.h3, color: t.text, marginTop: spacing.xs },
    hubDesc: { ...type.small, color: t.textMuted },
  });
