/**
 * Speaking practice: record → transcript → measured fluency + AI feedback.
 * Metrics (wpm, pauses, fillers) come from real measurements; pronunciation
 * scoring is explicitly not claimed.
 */

import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Banner, Chip, SectionTitle } from "../components/ui";
import { MicButton, CorrectionCard } from "../components/tutor";
import { useAppStore } from "../state/store";
import { useSpeechRecognition } from "../voice/asr";
import { spacing, type, useTheme } from "../core/theme";
import { api } from "../core/api";
import type { SpeakingAnalysisResponseT } from "../../../shared/src/contracts";
import { fluencyVerdict, analyzeText } from "../../../shared/src/analysis";

const PROMPTS = [
  "Describe your daily routine in detail.",
  "Talk about your best friend and how you met.",
  "Describe your hometown. What would a visitor enjoy?",
  "What did you do last weekend? Give details.",
  "Talk about a goal you have for this year.",
  "Describe the food you would serve at a celebration.",
];

export default function Speaking() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const asr = useSpeechRecognition();
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]!);
  const [analysis, setAnalysis] = useState<SpeakingAnalysisResponseT | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => asr.stop(), [asr]);

  const analyze = async (transcriptOverride?: string) => {
    const transcript = (transcriptOverride ?? asr.finalTranscript ?? asr.transcript).trim();
    if (!transcript || busy) return;
    setBusy(true);
    setError(null);
    try {
      const learner = await store.snapshot();
      const result = await api.analyzeSpeaking({
        learner,
        transcript,
        metrics: asr.metrics,
        prompt,
      });
      setAnalysis(result);
      for (const c of result.corrections) {
        await store.recordCorrections([c], transcript);
      }
      await store.recordSkillResult({
        skill: "fluency",
        correct: result.fluency.band !== "low",
        quality: result.fluency.band === "strong" ? 1 : result.fluency.band === "steady" ? 0.8 : 0.35,
        difficulty: learner.cefrLevel,
        kind: "speaking",
      });
      if (result.corrections.length > 0) {
        await store.recordSkillResult({
          skill: "grammar", correct: false, quality: 0.4,
          difficulty: learner.cefrLevel, kind: "speaking",
        });
      }
      await store.recordVocabulary(result.vocabulary);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — showing locally measured metrics only.`
          : "Analysis failed.",
      );
      // Honest offline fallback: measured metrics only, no fabricated scores.
      const m = analyzeText({ text: transcript, ...asr.metrics });
      const fv = fluencyVerdict(m);
      setAnalysis({
        feedback: `Offline: you spoke ${m.words} words. ${fv.reasons.join(" ")}`,
        corrections: [],
        vocabulary: [],
        measured: {
          wpm: m.wpm, fillerCount: m.fillerCount, fillerRate: m.fillerRate,
          diversity: m.diversity, avgSentenceLength: m.avgSentenceLength, words: m.words,
        },
        fluency: { band: fv.band, reasons: fv.reasons },
        pronunciationNote: "Pronunciation scoring is not available offline.",
        shouldRetry: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Speaking practice" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Card style={{ backgroundColor: theme.surfaceAlt }}>
          <Text style={styles.promptLabel}>Today's prompt</Text>
          <Text style={styles.prompt}>{prompt}</Text>
          <Text style={styles.hint}>Aim for 40+ words. Pausing quietly beats saying "um".</Text>
        </Card>

        <MicButton
          listening={asr.listening}
          onPress={() => {
            if (asr.listening) {
              void asr.stopAndCollect().then((text) => { if (text) void analyze(text); });
            } else {
              setAnalysis(null);
              void asr.start();
            }
          }}
          volume={asr.volume}
          accessibilityLabel="Record your speaking"
        />
        <Text style={styles.status}>
          {asr.listening ? "Listening… tap stop when done" : "Tap the mic and start speaking"}
        </Text>
        {asr.listening && asr.transcript ? (
          <Text style={styles.transcript}>“{asr.transcript}”</Text>
        ) : null}
        {asr.error ? <Banner tone="warn">{asr.error}</Banner> : null}
        {error ? <Banner tone="info">{error}</Banner> : null}

        {analysis ? (
          <>
            <SectionTitle>Your speaking feedback</SectionTitle>
            <Card>
              <View style={styles.metricsRow}>
                <Metric label="Words" value={String(analysis.measured.words)} />
                <Metric label="Pace" value={analysis.measured.wpm ? `${analysis.measured.wpm} wpm` : "—"} />
                <Metric label="Fillers" value={String(analysis.measured.fillerCount)} />
                <Metric label="Flow" value={analysis.fluency.band} />
              </View>
              <Text style={styles.feedback}>{analysis.feedback}</Text>
              {analysis.fluency.reasons.map((r, i) => (
                <Text key={i} style={styles.reason}>• {r}</Text>
              ))}
            </Card>
            {analysis.corrections.map((c, i) => <CorrectionCard key={i} correction={c} />)}
            <Banner tone="info">{analysis.pronunciationNote}</Banner>
            {analysis.shouldRetry ? (
              <Button label="Try again" variant="secondary" onPress={() => { setAnalysis(null); void asr.start(); }} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Metric(props: { label: string; value: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    promptLabel: { ...type.small, color: t.textMuted, textTransform: "uppercase" },
    prompt: { ...type.h3, color: t.text, marginTop: 4 },
    hint: { ...type.small, color: t.textMuted, marginTop: spacing.s, fontStyle: "italic" },
    status: { ...type.small, color: t.textMuted, textAlign: "center", marginTop: spacing.s },
    transcript: { ...type.small, color: t.accent, textAlign: "center", marginTop: spacing.xs, paddingHorizontal: spacing.l },
    metricsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: spacing.m },
    metric: { alignItems: "center" },
    metricValue: { ...type.h3, color: t.primary, textTransform: "capitalize" },
    metricLabel: { ...type.small, color: t.textMuted },
    feedback: { ...type.body, color: t.text, marginBottom: spacing.s },
    reason: { ...type.small, color: t.textMuted, marginBottom: 2 },
  });
