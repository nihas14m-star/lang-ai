/**
 * Profile & settings: edit profile, privacy controls, data deletion,
 * backend status, and honest feature status.
 */

import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Input, Banner, SectionTitle, Chip } from "../components/ui";
import { useAppStore } from "../state/store";
import { spacing, type, useTheme } from "../core/theme";
import { wipeAllData } from "../data/db";
import { profileRepo } from "../data/repos";
import { BACKEND_URL } from "../core/config";

export default function Profile() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const [name, setName] = useState(store.profile?.name ?? "");
  const [minutes, setMinutes] = useState(String(store.profile?.dailyGoalMinutes ?? 15));
  const [saved, setSaved] = useState(false);

  if (!store.profile) return null;

  const save = async () => {
    await profileRepo.updatePreferences({
      name: name.trim() || store.profile!.name,
      dailyGoalMinutes: Math.max(10, Math.min(60, Number(minutes) || 15)),
    });
    // Proper zustand state update (never mutate the store object directly).
    useAppStore.setState({ profile: await profileRepo.get() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const confirmWipe = () => {
    Alert.alert(
      "Delete all data?",
      "This permanently deletes your profile, conversations, mistakes, vocabulary and progress from this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: () => {
            void wipeAllData().then(() => {
              useAppStore.setState({ profile: null, mistakes: [], vocabCount: 0, mission: null, missionCompleted: [] });
              router.replace("/onboarding");
            });
          },
        },
      ],
    );
  };

  const connectionLabel =
    store.connection === "online" ? "AI tutor connected"
      : store.connection === "degraded" ? "Backend up · no AI key (rule-based tutor)"
        : store.connection === "checking" ? "Checking…"
          : "Offline — local practice only";

  return (
    <Screen title="Profile & settings" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Card>
          <Text style={styles.label}>Name</Text>
          <Input value={name} onChangeText={setName} accessibilityLabel="Your name" />
          <Text style={styles.label}>Daily goal (minutes)</Text>
          <Input
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            accessibilityLabel="Daily goal minutes"
          />
          <Button label="Save" onPress={() => void save()} style={{ marginTop: spacing.m }} />
          {saved ? <Banner tone="good">Saved.</Banner> : null}
        </Card>

        <SectionTitle>Tutor service</SectionTitle>
        <Card>
          <View style={styles.row}>
            <Text style={styles.label2}>Status</Text>
            <Chip
              label={connectionLabel}
              tone={store.connection === "online" ? "good" : store.connection === "degraded" ? "warn" : "bad"}
            />
          </View>
          <Text style={styles.muted}>Backend: {BACKEND_URL}</Text>
          {store.backendProvider ? (
            <Text style={styles.muted}>Active AI provider: {store.backendProvider}</Text>
          ) : null}
          <Text style={styles.muted}>
            To enable full AI feedback, set NVIDIA_API_KEY (or another provider) on the backend server.
            The app itself never holds API keys.
          </Text>
        </Card>

        <SectionTitle>Privacy</SectionTitle>
        <Card>
          <Text style={styles.privacyLine}>• All learner data (profile, mistakes, vocabulary, conversations) is stored only on this device.</Text>
          <Text style={styles.privacyLine}>• Audio is never stored: speech is transcribed on-device and only the text is used.</Text>
          <Text style={styles.privacyLine}>• The backend receives only an ephemeral learning snapshot per request and stores nothing about you.</Text>
          <Text style={styles.privacyLine}>• Microphone access is requested only when you start a speaking activity.</Text>
          <Button label="Delete all my data" variant="danger" onPress={confirmWipe} style={{ marginTop: spacing.m }} />
        </Card>

        <SectionTitle>Feature status</SectionTitle>
        <Card>
          <Text style={styles.statusLine}>✅ Grammar, vocabulary & SRS review — fully on-device</Text>
          <Text style={styles.statusLine}>✅ Conversation, writing, interview, listening feedback — needs backend (offline fallback: rule-based)</Text>
          <Text style={styles.statusLine}>✅ Speech-to-text (on-device recognizer) & text-to-speech</Text>
          <Text style={styles.statusLine}>⚠️ Pronunciation scoring — NOT available (recognition hints only, honestly labeled)</Text>
          <Text style={styles.statusLine}>⚠️ CEFR estimate — diagnostic estimate, not an official certification</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: { ...type.h3, color: t.text, marginTop: spacing.m, marginBottom: spacing.s },
    label2: { ...type.h3, color: t.text, flex: 1 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.s },
    muted: { ...type.small, color: t.textMuted, marginTop: spacing.xs, lineHeight: 18 },
    privacyLine: { ...type.small, color: t.text, marginBottom: spacing.s, lineHeight: 18 },
    statusLine: { ...type.small, color: t.text, marginBottom: spacing.xs, lineHeight: 18 },
  });
