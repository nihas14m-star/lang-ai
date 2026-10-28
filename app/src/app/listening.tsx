/**
 * Listening practice: TTS dictation exercises, scored locally by word overlap.
 * Fully offline-capable (TTS is on-device).
 */

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Banner, Chip, ProgressBar } from "../components/ui";
import { useAppStore } from "../state/store";
import { speak } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { ASSESSMENT_ITEMS } from "../../../shared/src/assessment";
import { scoreObjectiveResponses, type AssessmentResponse } from "../../../shared/src/assessment";
import { pickDrills } from "../../../shared/src/exercises";

/** Reuse the dictation items + generate level-appropriate practice sentences. */
const DICTATION_ITEMS = ASSESSMENT_ITEMS.filter((i) => i.type === "dictation");

const EXTRA_SENTENCES: Array<{ text: string; level: string }> = [
  { text: "My brother works at a hospital near the city center.", level: "A2" },
  { text: "We are planning to visit our grandparents next month.", level: "A2" },
  { text: "She didn't come to class because she was not feeling well.", level: "B1" },
  { text: "If you finish your assignment early, you can join us for lunch.", level: "B1" },
  { text: "The manager said the new policy would be announced next week.", level: "B1" },
  { text: "Despite the heavy rain, the construction work continued without interruption.", level: "B2" },
  { text: "It is essential that every participant submits the form before the deadline.", level: "B2" },
];

export default function Listening() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();

  const exercises = useMemo(() => {
    const level = store.profile?.cefrLevel ?? "A2";
    const items = DICTATION_ITEMS.map((d) => ({ text: d.speakText ?? "", level: d.level as string }));
    const extras = EXTRA_SENTENCES.filter((s) => s.level <= level).map((s) => ({ text: s.text, level: s.level }));
    const all: Array<{ text: string; level: string }> = [...items, ...extras];
    // random shuffle for variety
    return all.sort(() => Math.random() - 0.5).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<{ score: number } | null>(null);
  const [plays, setPlays] = useState(0);
  const [done, setDone] = useState(false);
  const [scores, setScores] = useState<AssessmentResponse[]>([]);

  const exercise = exercises[index];

  if (!exercise || done) {
    const { sectionScores } = scoreObjectiveResponses(scores.filter((s) => s.itemId.startsWith("listen")));
    const listening = sectionScores.get("listening");
    return (
      <Screen title="Listening complete" onBack={() => router.replace("/")}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <Card>
            <Text style={styles.score}>{listening?.score ?? 0}/100</Text>
            <Text style={styles.scoreLabel}>average word accuracy across {scores.length} sentences</Text>
          </Card>
          <Banner tone="good">Replay and re-listen to any sentence to train your ear. Sentences get faster as you improve.</Banner>
          <Button label="Back to home" onPress={() => router.replace("/")} />
        </ScrollView>
      </Screen>
    );
  }

  const check = async () => {
    const target = exercise.text;
    const t = target.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    const a = new Set(answer.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
    let hits = 0;
    for (const w of t) if (a.has(w)) hits++;
    const score = t.length ? Math.round((hits / t.length) * 100) : 0;
    setChecked({ score });
    setScores((prev) => [...prev, { itemId: `listen-${index}`, answer }]);
    await store.recordSkillResult({
      skill: "listening", correct: score >= 60, quality: score / 100,
      difficulty: exercise.level, kind: "listening",
    });
  };

  const next = () => {
    setChecked(null);
    setAnswer("");
    setPlays(0);
    if (index + 1 >= exercises.length) setDone(true);
    else setIndex(index + 1);
  };

  return (
    <Screen title="Listening practice" subtitle={`Sentence ${index + 1} of ${exercises.length} · ${exercise.level}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ProgressBar value={index / exercises.length} />
        <Card style={{ marginTop: spacing.m }}>
          <View style={styles.playRow}>
            <Chip label={`${plays} play${plays === 1 ? "" : "s"}`} />
            <Text style={styles.hint}>Listen as many times as you need.</Text>
          </View>
          <Button
            label="▶ Play sentence"
            onPress={() => { setPlays((p) => p + 1); speak(exercise.text, { rate: plays >= 2 ? 1.0 : 0.9 }); }}
            accessibilityLabel="Play the sentence"
          />
          <Text style={styles.typeNow}>Type exactly what you hear:</Text>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder="Type the sentence…"
            placeholderTextColor={theme.textMuted}
            multiline
            editable={!checked}
            accessibilityLabel="Dictation input"
            style={styles.textInput}
          />
          {checked ? (
            <>
              <Banner tone={checked.score >= 60 ? "good" : "warn"}>
                Word accuracy: {checked.score}%
              </Banner>
              <Text style={styles.target}>
                <Text style={{ color: theme.textMuted }}>The sentence: </Text>
                <Text style={{ color: theme.success, fontWeight: "700" }}>{exercise.text}</Text>
              </Text>
            </>
          ) : null}
        </Card>

        {checked ? (
          <Button label={index + 1 >= exercises.length ? "See results" : "Next sentence"} onPress={next} />
        ) : (
          <Button label="Check" onPress={() => void check()} disabled={!answer.trim()} />
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    playRow: { flexDirection: "row", alignItems: "center", gap: spacing.s, marginBottom: spacing.m },
    hint: { ...type.small, color: t.textMuted, flex: 1 },
    typeNow: { ...type.h3, color: t.text, marginTop: spacing.l, marginBottom: spacing.s },
    textInput: {
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1, borderColor: t.border,
      color: t.text, paddingHorizontal: spacing.m, paddingVertical: 12, fontSize: 15, minHeight: 90,
      textAlignVertical: "top",
    },
    target: { ...type.body, marginTop: spacing.m, lineHeight: 22 },
    score: { ...type.title, fontSize: 40, color: t.primary, textAlign: "center" },
    scoreLabel: { ...type.small, color: t.textMuted, textAlign: "center" },
  });
