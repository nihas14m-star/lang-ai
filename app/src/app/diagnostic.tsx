/**
 * Diagnostic assessment: grammar, vocabulary, listening (dictation via TTS),
 * reading, writing, speaking (mic or typed). Objective items are scored on
 * device; open items go to the backend AI (with an honest offline fallback).
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Input, Banner, Chip, ProgressBar, SectionTitle } from "../components/ui";
import { useAppStore } from "../state/store";
import { useSpeechRecognition } from "../voice/asr";
import { speak, stopSpeaking } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { api, ApiError } from "../core/api";
import { localEvaluate } from "../ai/localTutor";
import {
  ASSESSMENT_ITEMS, scoreObjectiveResponses, buildDiagnosticResult,
  type AssessmentItem, type AssessmentResponse, type DiagnosticResult,
} from "../../../shared/src/assessment";
import { MicButton } from "../components/tutor";

type Phase = "running" | "scoring" | "done";

export default function Diagnostic() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const asr = useSpeechRecognition();

  const [phase, setPhase] = useState<Phase>("running");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [speakingMetrics, setSpeakingMetrics] = useState<Record<string, ReturnType<typeof useSpeechRecognition>["metrics"]>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const item: AssessmentItem | undefined = ASSESSMENT_ITEMS[index];
  const progress = ASSESSMENT_ITEMS.length > 0 ? index / ASSESSMENT_ITEMS.length : 0;

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const next = async () => {
    stopSpeaking();
    if (item && (asr.finalTranscript.trim() || asr.transcript.trim())) {
      const spoken = await asr.stopAndCollect(3000).catch(() => asr.finalTranscript);
      if (spoken) {
        setSpeakingMetrics((prev) => ({ ...prev, [item.id]: asr.metrics }));
        setAnswer(item.id, spoken);
      }
    } else {
      asr.stop();
    }
    if (index + 1 >= ASSESSMENT_ITEMS.length) {
      void finish();
    } else {
      setIndex(index + 1);
    }
  };

  const finish = async () => {
    setPhase("scoring");
    // 1. Objective sections: scored locally and deterministically.
    const objectiveResponses: AssessmentResponse[] = Object.entries(answers)
      .filter(([itemId]) => {
        const it = ASSESSMENT_ITEMS.find((i) => i.id === itemId);
        return it && it.type !== "open" && answers[itemId]?.trim();
      })
      .map(([itemId, answer]) => ({ itemId, answer }));
    const { sectionScores } = scoreObjectiveResponses(objectiveResponses);

    // 2. Open sections: AI-scored when online; skipped (honestly) offline.
    const openResponses = ASSESSMENT_ITEMS
      .filter((it) => it.type === "open" && answers[it.id]?.trim())
      .map((it) => ({
        itemId: it.id,
        section: it.section as "writing" | "speaking",
        prompt: it.prompt,
        response: answers[it.id]!,
        metrics: { durationSec: it.section === "speaking" ? speakingMetrics[it.id]?.durationSec : undefined },
      }));

    let openScores: { writing?: number; speaking?: number } | undefined;
    try {
      const learner = await store.snapshot();
      const response = await api.assessment({
        learner,
        responses: openResponses,
        objectiveResponses,
      } as never);
      const writing = response.skillScores.writing;
      const speaking = response.skillScores.speaking;
      openScores = {
        writing: writing !== undefined ? writing : undefined,
        speaking: speaking !== undefined ? speaking : undefined,
      };
      if (response.aiFeedback) {
        setAiNote(
          [response.aiFeedback.writingFeedback, response.aiFeedback.speakingFeedback, response.aiFeedback.rationale]
            .filter(Boolean).join(" "),
        );
      }
    } catch (err) {
      // Offline: use the rule-based local estimate, clearly labeled.
      const writingText = answers["w1"];
      const speakingText = answers["s1"];
      if (writingText) {
        const local = localEvaluate(writingText, "writing");
        openScores = { ...openScores, writing: local.score };
      }
      if (speakingText) {
        const local = localEvaluate(speakingText, "speaking");
        openScores = { ...openScores, speaking: local.score };
      }
      setAiNote(
        err instanceof ApiError
          ? "Assessed offline with rule-based scoring. Connect to the tutor service for a full AI evaluation."
          : "Open answers were scored with basic rules.",
      );
    }

    const diagnostic = buildDiagnosticResult(sectionScores, openScores);
    await store.saveDiagnostic(diagnostic);
    setResult(diagnostic);
    setPhase("done");
  };

  if (phase === "done" && result) {
    return (
      <Screen title="Your estimated level" onBack={() => router.replace("/")}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <Card>
            <Text style={styles.bigLevel}>{result.overall?.level ?? "—"}</Text>
            <Text style={styles.confidence}>Confidence: {result.overall?.confidence ?? "low"} (based on {result.overall?.skillsMeasured.length ?? 0} skill areas)</Text>
            <Text style={styles.disclaimer}>{result.disclaimer}</Text>
          </Card>

          <SectionTitle>Skill breakdown</SectionTitle>
          {result.sections.map((s) => (
            <Card key={s.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.skillName}>{s.section}</Text>
                <Chip label={`${s.score}/100 · ${s.source}`} tone={s.score >= 65 ? "good" : s.score >= 40 ? "warn" : "bad"} />
              </View>
              <ProgressBar value={s.score / 100} />
            </Card>
          ))}

          <SectionTitle>Recommended next steps</SectionTitle>
          <Card>
            {result.recommendedPractice.map((r, i) => (
              <Text key={i} style={styles.reco}>• {r}</Text>
            ))}
          </Card>
          {aiNote ? <Banner tone="info">{aiNote}</Banner> : null}
          <Button label="Start practicing" onPress={() => router.replace("/")} />
        </ScrollView>
      </Screen>
    );
  }

  if (phase === "scoring" || !item) {
    return (
      <Screen title="Assessing…">
        <Card><Text style={{ ...type.body, color: theme.textMuted }}>Scoring your answers…</Text></Card>
      </Screen>
    );
  }

  const answer = answers[item.id] ?? "";
  const isSpeakingItem = item.section === "speaking";

  return (
    <Screen
      title={`Diagnostic · ${item.section}`}
      subtitle={`Question ${index + 1} of ${ASSESSMENT_ITEMS.length}`}
      onBack={() => (index > 0 ? setIndex(index - 1) : router.back())}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ProgressBar value={progress} />
        <Card style={{ marginTop: spacing.m }}>
          <Text style={styles.prompt}>{item.prompt}</Text>
          {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}

          {/* Choose-type */}
          {item.type === "choose" && item.options?.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setAnswer(item.id, opt)}
              accessibilityRole="radio"
              accessibilityState={{ selected: answer === opt }}
              style={[styles.option, answer === opt && styles.optionSelected]}
            >
              <Text style={[styles.optionText, answer === opt && styles.optionTextSelected]}>{opt.trim()}</Text>
            </Pressable>
          ))}

          {/* Dictation: TTS speaks, learner types */}
          {item.type === "dictation" && (
            <View>
              <Button
                label="▶ Play audio"
                variant="secondary"
                onPress={() => speak(item.speakText ?? "", { level: "B1" })}
                accessibilityLabel="Play the sentence audio"
              />
              <Text style={styles.hint}>Listen, then type exactly what you hear. You can replay it.</Text>
            </View>
          )}

          {/* Fill / dictation / open: text input */}
          {(item.type === "fill_blank" || item.type === "dictation") && (
            <Input
              value={answer}
              onChangeText={(v) => setAnswer(item.id, v)}
              placeholder="Type your answer"
              accessibilityLabel="Answer input"
              style={{ marginTop: spacing.m }}
            />
          )}

          {/* Writing (open) */}
          {item.type === "open" && item.section === "writing" && (
            <Input
              value={answer}
              onChangeText={(v) => setAnswer(item.id, v)}
              placeholder={`Write 3-5 sentences… (max ${item.maxWords ?? 120} words)`}
              multiline
              accessibilityLabel="Writing answer"
              style={{ marginTop: spacing.m, minHeight: 140 }}
            />
          )}

          {/* Speaking (open): mic or typing */}
          {isSpeakingItem && (
            <View style={{ marginTop: spacing.m, alignItems: "center" }}>
              <MicButton
                listening={asr.listening}
                onPress={() => (asr.listening ? asr.stop() : void asr.start())}
                volume={asr.volume}
              />
              {asr.error ? <Banner tone="warn">{asr.error}</Banner> : null}
              {asr.transcript ? (
                <Text style={styles.transcript}>Heard: “{asr.transcript}”</Text>
              ) : (
                <Text style={styles.hint}>
                  {asr.supported === false
                    ? "Speech recognition is unavailable on this device — type what you would say instead."
                    : "Tap Speak, answer aloud, then tap Stop. Or type your answer below."}
                </Text>
              )}
              <Input
                value={answer}
                onChangeText={(v) => setAnswer(item.id, v)}
                placeholder="Or type your answer here"
                multiline
                accessibilityLabel="Speaking answer (typed)"
                style={{ marginTop: spacing.m, minHeight: 100, alignSelf: "stretch" }}
              />
            </View>
          )}
        </Card>

        {submitError ? <Banner tone="bad">{submitError}</Banner> : null}

        <Button
          label={index + 1 >= ASSESSMENT_ITEMS.length ? "Finish and see results" : "Next"}
          onPress={next}
          disabled={item.type === "choose" ? !answer : false}
        />
        <Text style={styles.hint}>Answer honestly — this sets your starting level and daily plan.</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    prompt: { ...type.h3, color: t.text, marginBottom: spacing.m },
    hint: { ...type.small, color: t.textMuted, marginTop: spacing.s },
    option: {
      borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface,
      padding: spacing.m, marginBottom: spacing.s,
    },
    optionSelected: { backgroundColor: t.primary, borderColor: t.primary },
    optionText: { ...type.body, color: t.text },
    optionTextSelected: { color: t.primaryText },
    bigLevel: { ...type.title, fontSize: 44, color: t.primary, textAlign: "center" },
    confidence: { ...type.small, color: t.textMuted, textAlign: "center", marginTop: 4 },
    disclaimer: { ...type.small, color: t.textMuted, fontStyle: "italic", textAlign: "center", marginTop: spacing.s },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.s },
    skillName: { ...type.h3, color: t.text, textTransform: "capitalize" },
    reco: { ...type.body, color: t.text, marginBottom: spacing.xs },
    transcript: { ...type.small, color: t.accent, marginTop: spacing.m, textAlign: "center" },
  });
