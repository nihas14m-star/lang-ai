/**
 * Spaced repetition review session: due vocabulary + due mistakes.
 * The learner self-grades (recalled / didn't recall); SM-2 reschedules.
 */

import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Screen, Card, Button, Banner, ProgressBar, EmptyState, Chip } from "../components/ui";
import { useAppStore } from "../state/store";
import { vocabRepo, mistakesRepo, type VocabRow } from "../data/repos";
import { speak } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { isDue } from "../../../shared/src/srs";
import type { MistakeRecord } from "../../../shared/src/mistakes";

interface ReviewItem {
  kind: "vocab" | "mistake";
  id: string;
  front: string;
  back: string;
  hint?: string;
  speakText?: string;
}

export default function Review() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, total: 0 });

  const load = useCallback(async () => {
    const vocabDue = await vocabRepo.due(8);
    const mistakesDue = await mistakesRepo.due(6);
    const list: ReviewItem[] = [
      ...vocabDue.map((v: VocabRow) => ({
        kind: "vocab" as const, id: v.word, front: v.word,
        back: `${v.meaning}${v.example ? `\n\n“${v.example}”` : ""}`,
        hint: v.partOfSpeech, speakText: v.word,
      })),
      ...mistakesDue.map((m: MistakeRecord) => ({
        kind: "mistake" as const, id: m.id,
        front: `Fix: “${m.original}”`,
        back: `“${m.corrected}”\n\n${m.explanation}`,
        hint: m.category.replace(/_/g, " "),
      })),
    ];
    setItems(list);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => { setIndex(0); setRevealed(false); };
    }, [load]),
  );

  const grade = async (correct: boolean) => {
    const item = items[index];
    if (!item) return;
    if (item.kind === "vocab") {
      await vocabRepo.reviewResult(item.id, correct);
    } else {
      await mistakesRepo.reviewResult(item.id, correct);
    }
    await store.recordSkillResult({
      skill: item.kind === "vocab" ? "vocabulary" : "grammar",
      correct, quality: correct ? 0.85 : 0.3,
      difficulty: store.profile?.cefrLevel ?? "B1",
      kind: item.kind === "vocab" ? "vocab_review" : "mistake_review",
      refId: item.id,
    });
    setResults((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (!loaded) {
    return (
      <Screen title="Review" onBack={() => router.back()}>
        <Card><Text style={{ ...type.body, color: theme.textMuted }}>Loading…</Text></Card>
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen title="Review" onBack={() => router.back()}>
        <EmptyState
          title="Nothing due right now 🎉"
          message="Words and mistakes appear here when they're scheduled for review. Practice conversations and drills to add more."
        />
        <Button label="Back to home" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (index >= items.length) {
    return (
      <Screen title="Review complete" onBack={() => router.replace("/")}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <Card>
            <Text style={styles.score}>{results.correct}/{results.total}</Text>
            <Text style={styles.scoreLabel}>recalled correctly</Text>
          </Card>
          <Banner tone="good">
            Items you recalled move further into the future; the ones you missed come back tomorrow (SM-2 scheduling).
          </Banner>
          <Button label="Done" onPress={() => router.replace("/")} />
        </ScrollView>
      </Screen>
    );
  }

  const item = items[index]!;
  return (
    <Screen
      title="Spaced review"
      subtitle={`Card ${index + 1} of ${items.length} · ${item.kind === "vocab" ? "vocabulary" : "mistake"}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ProgressBar value={index / items.length} />
        <Card style={{ marginTop: spacing.m, minHeight: 180, justifyContent: "center" }}>
          <View style={{ alignItems: "center" }}>
            {item.hint ? <Chip label={item.hint} /> : null}
            <Text style={styles.front}>{item.front}</Text>
            {item.speakText && revealed ? (
              <Button
                label="▶ Hear it"
                variant="secondary"
                onPress={() => speak(item.speakText ?? "")}
                style={{ marginTop: spacing.s }}
              />
            ) : null}
            {revealed ? (
              <Text style={styles.back}>{item.back}</Text>
            ) : (
              <Text style={styles.hint}>Think of the answer, then reveal.</Text>
            )}
          </View>
        </Card>

        {!revealed ? (
          <Button label="Reveal answer" onPress={() => setRevealed(true)} />
        ) : (
          <View style={{ gap: spacing.s }}>
            <Button label="✓ I recalled it" variant="primary" onPress={() => void grade(true)} />
            <Button label="✗ Didn't recall" variant="secondary" onPress={() => void grade(false)} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    front: { ...type.title, color: t.text, textAlign: "center", marginTop: spacing.m },
    back: { ...type.body, color: t.text, textAlign: "center", marginTop: spacing.m, lineHeight: 22 },
    hint: { ...type.small, color: t.textMuted, textAlign: "center", marginTop: spacing.m },
    score: { ...type.title, fontSize: 40, color: t.primary, textAlign: "center" },
    scoreLabel: { ...type.small, color: t.textMuted, textAlign: "center" },
  });
