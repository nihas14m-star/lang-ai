/**
 * Grammar drills: targeted practice from the built-in bank (works offline),
 * prioritized by the learner's weakest topics. Scoring is deterministic.
 */

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Banner, Chip, ProgressBar, SectionTitle } from "../components/ui";
import { useAppStore } from "../state/store";
import { spacing, type, useTheme } from "../core/theme";
import { pickDrills, checkDrillAnswer, DRILLS, type Drill } from "../../../shared/src/exercises";
import { prioritizeTopics } from "../../../shared/src/curriculum";

interface Answered {
  drill: Drill;
  response: string;
  correct: boolean;
}

export default function Grammar() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const { profile, mistakes } = store;

  const [sessionId] = useState(() => `g_${Date.now()}`);
  const [current, setCurrent] = useState(0);
  const [response, setResponse] = useState("");
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [checked, setChecked] = useState<{ correct: boolean; expected: string } | null>(null);
  const [done, setDone] = useState(false);

  // Prioritized topic: weakest area from the curriculum engine.
  const drills = useMemo(() => {
    if (!profile) return pickDrills({ count: 5, seed: 1 });
    const priorities = prioritizeTopics({
      cefrLevel: profile.cefrLevel as never,
      mistakes,
      grammarScore: profile.skillScores.grammar,
    });
    const topic = priorities[0]?.topic.id;
    const pool = pickDrills({ topicId: topic, count: 5, seed: Date.now() % 100000 });
    return pool.length >= 3 ? pool : pickDrills({ count: 5, seed: Date.now() % 100000 });
  }, [profile, mistakes]);

  if (!profile) return null;

  if (done) {
    const correctCount = answered.filter((a) => a.correct).length;
    return (
      <Screen title="Session complete" onBack={() => router.back()}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <Card>
            <Text style={styles.scoreBig}>{correctCount}/{answered.length}</Text>
            <Text style={styles.scoreLabel}>correct answers</Text>
            <ProgressBar value={answered.length ? correctCount / answered.length : 0} />
          </Card>
          {answered.map((a, i) => (
            <Card key={i}>
              <View style={styles.summaryRow}>
                <Chip label={a.correct ? "✓ correct" : "✗ review"} tone={a.correct ? "good" : "bad"} />
                <Text style={styles.summaryPrompt}>{a.drill.prompt}</Text>
              </View>
              {!a.correct ? (
                <Text style={styles.summaryAnswer}>
                  Answer: <Text style={{ color: theme.success, fontWeight: "700" }}>{a.drill.answers[0]}</Text>
                </Text>
              ) : null}
              <Text style={styles.explanation}>{a.drill.explanation}</Text>
            </Card>
          ))}
          <Button label="Back to home" onPress={() => router.replace("/")} />
        </ScrollView>
      </Screen>
    );
  }

  const drill = drills[current];
  if (!drill) return null;

  const submit = async () => {
    if (!response.trim() && drill.type !== "choose") return;
    const result = checkDrillAnswer(drill, response);
    setChecked({ correct: result.correct, expected: drill.answers[0] ?? "" });
    setAnswered((prev) => [...prev, { drill, response, correct: result.correct }]);
    await store.recordSkillResult({
      skill: "grammar",
      correct: result.correct,
      quality: result.correct ? 0.9 : 0.25,
      difficulty: drill.level,
      kind: "grammar_drill",
      refId: drill.id,
      topicId: drill.topicId,
    });
    if (!result.correct) {
      await store.recordCorrections([{
        original: response || drill.prompt,
        corrected: drill.answers[0] ?? "",
        explanation: drill.explanation,
        category: "structure",
        severity: "critical",
      }], drill.prompt);
    }
  };

  const next = () => {
    setChecked(null);
    setResponse("");
    if (current + 1 >= drills.length) {
      setDone(true);
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <Screen
      title="Grammar practice"
      subtitle={`Question ${current + 1} of ${drills.length} · ${drill.level} · ${drill.topicId.replace(/_/g, " ")}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ProgressBar value={current / drills.length} />
        <Card style={{ marginTop: spacing.m }}>
          <Text style={styles.prompt}>{drill.prompt}</Text>

          {drill.type === "choose" && drill.options?.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setResponse(opt)}
              accessibilityRole="radio"
              accessibilityState={{ selected: response === opt }}
              style={[styles.option, response === opt && styles.optionSelected, checked && styles.optionLocked]}
            >
              <Text style={[styles.optionText, response === opt && styles.optionTextSelected]}>{opt.trim()}</Text>
            </Pressable>
          ))}

          {drill.type !== "choose" && (
            <View style={{ marginTop: spacing.m }}>
              <Text style={styles.typeHint}>
                {drill.type === "fill_blank" ? "Type the missing word(s)." : "Rewrite the sentence correctly."}
              </Text>
              <TextInput
                value={response}
                onChangeText={setResponse}
                placeholder="Your answer"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Answer input"
                editable={!checked}
                style={styles.textInput}
              />
            </View>
          )}

          {checked ? (
            <View style={{ marginTop: spacing.m }}>
              <Banner tone={checked.correct ? "good" : "bad"}>
                {checked.correct ? "✓ Correct!" : `✗ The answer: "${checked.expected}"`}
              </Banner>
              <Text style={styles.explanation}>{drill.explanation}</Text>
            </View>
          ) : null}
        </Card>

        {checked ? (
          <Button label={current + 1 >= drills.length ? "See results" : "Next question"} onPress={next} />
        ) : (
          <Button label="Check answer" onPress={() => void submit()} disabled={!response.trim()} />
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    prompt: { ...type.h3, color: t.text },
    typeHint: { ...type.small, color: t.textMuted, marginBottom: spacing.s },
    explanation: { ...type.small, color: t.textMuted, marginTop: spacing.s, lineHeight: 18 },
    option: {
      borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface,
      padding: spacing.m, marginBottom: spacing.s, marginTop: spacing.s,
    },
    optionSelected: { backgroundColor: t.primary, borderColor: t.primary },
    optionLocked: { opacity: 0.8 },
    optionText: { ...type.body, color: t.text },
    optionTextSelected: { color: t.primaryText },
    textInput: {
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1, borderColor: t.border,
      color: t.text, paddingHorizontal: spacing.m, paddingVertical: 12, fontSize: 15,
    },
    scoreBig: { ...type.title, fontSize: 40, color: t.primary, textAlign: "center" },
    scoreLabel: { ...type.small, color: t.textMuted, textAlign: "center", marginBottom: spacing.m },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.s, marginBottom: 4 },
    summaryPrompt: { ...type.body, color: t.text, flex: 1 },
    summaryAnswer: { ...type.body, color: t.text, marginTop: 4 },
  });
