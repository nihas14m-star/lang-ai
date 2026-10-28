/**
 * Onboarding: profile creation + goals, then the diagnostic assessment.
 */

import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Input, SectionTitle } from "../components/ui";
import { useAppStore } from "../state/store";
import { spacing, type, useTheme } from "../core/theme";

const GOAL_OPTIONS = [
  "Speak fluently in daily life",
  "Clear college/work interviews",
  "Improve written English",
  "Prepare for exams",
  "Expand my vocabulary",
  "Sound more natural internationally",
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const NATIVE_LANGUAGES = ["Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Urdu", "Other"];

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const createProfile = useAppStore((s) => s.createProfile);

  const [name, setName] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("Hindi");
  const [goals, setGoals] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [targetLevel, setTargetLevel] = useState<string>("B2");
  const [saving, setSaving] = useState(false);

  const toggleGoal = (goal: string) => {
    setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal].slice(0, 4));
  };

  const start = async () => {
    setSaving(true);
    try {
      await createProfile({
        name: name.trim() || "Learner",
        nativeLanguage,
        goals,
        dailyGoalMinutes: dailyMinutes,
        targetLevel,
      });
      router.replace("/diagnostic");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Welcome" subtitle="Set up your personal learning profile" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Card>
          <Text style={styles.label}>What should your tutor call you?</Text>
          <Input value={name} onChangeText={setName} placeholder="Your name" accessibilityLabel="Your name" />

          <Text style={styles.label}>Your native language</Text>
          <View style={styles.wrap}>
            {NATIVE_LANGUAGES.map((lang) => (
              <Pressable
                key={lang}
                onPress={() => setNativeLanguage(lang)}
                accessibilityRole="radio"
                accessibilityState={{ selected: nativeLanguage === lang }}
                style={[styles.option, nativeLanguage === lang && styles.optionSelected]}
              >
                <Text style={[styles.optionText, nativeLanguage === lang && styles.optionTextSelected]}>{lang}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionTitle>Why are you learning English?</SectionTitle>
        <Card>
          <View style={styles.wrap}>
            {GOAL_OPTIONS.map((goal) => (
              <Pressable
                key={goal}
                onPress={() => toggleGoal(goal)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: goals.includes(goal) }}
                style={[styles.option, goals.includes(goal) && styles.optionSelected]}
              >
                <Text style={[styles.optionText, goals.includes(goal) && styles.optionTextSelected]}>{goal}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <SectionTitle>Daily practice time</SectionTitle>
        <Card>
          <View style={styles.wrap}>
            {[10, 15, 30, 45].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setDailyMinutes(mins)}
                accessibilityRole="radio"
                accessibilityState={{ selected: dailyMinutes === mins }}
                style={[styles.option, dailyMinutes === mins && styles.optionSelected]}
              >
                <Text style={[styles.optionText, dailyMinutes === mins && styles.optionTextSelected]}>{mins} min</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Target level</Text>
          <View style={styles.wrap}>
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => setTargetLevel(level)}
                accessibilityRole="radio"
                accessibilityState={{ selected: targetLevel === level }}
                style={[styles.option, targetLevel === level && styles.optionSelected]}
              >
                <Text style={[styles.optionText, targetLevel === level && styles.optionTextSelected]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Button label="Start diagnostic assessment" onPress={start} loading={saving} />
        <Text style={styles.note}>
          The diagnostic checks grammar, vocabulary, listening, reading, writing and speaking, then
          estimates your CEFR level (A1–C2). It's a starting point — not an official certification.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: { ...type.h3, color: t.text, marginTop: spacing.l, marginBottom: spacing.s },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.s },
    option: {
      borderRadius: 999, borderWidth: 1, borderColor: t.border,
      paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.surface,
    },
    optionSelected: { backgroundColor: t.primary, borderColor: t.primary },
    optionText: { ...type.small, color: t.text },
    optionTextSelected: { color: t.primaryText, fontWeight: "600" },
    note: { ...type.small, color: t.textMuted, marginTop: spacing.m, lineHeight: 18 },
  });
