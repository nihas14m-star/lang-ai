/**
 * Writing practice: paragraph/email/essay feedback. The AI explains every
 * issue instead of silently rewriting; offline gets rule-based checks.
 */

import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Banner, Chip, SectionTitle } from "../components/ui";
import { CorrectionCard } from "../components/tutor";
import { useAppStore } from "../state/store";
import { spacing, type, useTheme } from "../core/theme";
import { api } from "../core/api";
import { analyzeText } from "../../../shared/src/analysis";
import { heuristicDetect } from "../../../shared/src/mistakes";
import { scanIndianEnglish } from "../../../shared/src/indian-english";
import type { WritingAnalysisResponseT } from "../../../shared/src/contracts";

const TASKS = [
  { id: "paragraph", label: "Paragraph", prompt: "Write 4-6 sentences about your week." },
  { id: "email", label: "Email", prompt: "Write a short email asking your teacher for a deadline extension." },
  { id: "essay", label: "Essay", prompt: "Write a short essay: 'Technology in education — helpful or distracting?'" },
  { id: "summary", label: "Summary", prompt: "Summarize a book, movie, or news story in 5 sentences." },
] as const;

export default function Writing() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const [task, setTask] = useState<(typeof TASKS)[number]>(TASKS[0]!);
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<WritingAnalysisResponseT | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const learner = await store.snapshot();
      const result = await api.analyzeWriting({
        learner, text, taskType: task.id, prompt: task.prompt,
      });
      setAnalysis(result);
      // Record grammar observations + mistakes from issues.
      const grammarIssues = result.issues.filter((i) => i.type === "grammar");
      await store.recordSkillResult({
        skill: "writing",
        correct: result.overallScore >= 60,
        quality: result.overallScore / 100,
        difficulty: learner.cefrLevel,
        kind: "writing",
      });
      for (const issue of grammarIssues.slice(0, 3)) {
        await store.recordCorrections([{
          original: issue.original,
          corrected: issue.suggestion,
          explanation: issue.explanation,
          category: "structure",
          severity: "improvement",
        }], text.slice(0, 200));
      }
    } catch (err) {
      // Offline: rule-based analysis only, honestly labeled.
      const hits = heuristicDetect(text);
      const notes = scanIndianEnglish(text).filter((n) => n.kind === "commonly-corrected");
      const m = analyzeText({ text });
      setAnalysis({
        overallScore: Math.max(45, 90 - hits.length * 10),
        strengths: [`You wrote ${m.words} words across ${m.sentences} sentence(s).`],
        issues: [
          ...hits.map((h) => ({ type: "grammar" as const, original: h.original, suggestion: h.corrected, explanation: h.explanation })),
          ...notes.map((n) => ({
            type: "naturalness" as const,
            original: /You said "([^"]+)"/.exec(n.message)?.[1] ?? "",
            suggestion: /→ "([^"]+)"/.exec(n.message)?.[1] ?? "",
            explanation: n.message,
          })),
        ],
        improvedVersion: text,
        dontAutoRewriteNote: "Offline mode: only rule-based checks ran. Connect to the tutor service for full AI writing feedback.",
      });
      setError("Analyzed offline with rule-based checks.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Writing practice" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.taskRow}>
          {TASKS.map((t) => (
            <Chip
              key={t.id}
              label={t.label}
              tone={task.id === t.id ? "good" : "default"}
            />
          ))}
        </View>
        {TASKS.map((t) => task.id === t.id ? (
          <Card key={t.id} style={{ backgroundColor: theme.surfaceAlt }}>
            <Text style={styles.prompt}>{t.prompt}</Text>
          </Card>
        ) : null)}

        {!analysis ? (
          <View style={styles.taskSelector}>
            {TASKS.map((t) => (
              <Button
                key={t.id}
                label={t.label}
                variant={task.id === t.id ? "primary" : "secondary"}
                onPress={() => setTask(t)}
                style={{ marginRight: spacing.s, marginBottom: spacing.s }}
              />
            ))}
          </View>
        ) : null}

        <Card>
          <Text style={styles.taskPrompt}>{task.prompt}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Start writing…"
            multiline
            editable={!analysis}
            accessibilityLabel="Writing input"
            style={styles.input}
          />
          <Text style={styles.wordCount}>{text.trim() ? text.trim().split(/\s+/).length : 0} words</Text>
        </Card>

        {!analysis ? (
          <Button label="Get feedback" onPress={() => void submit()} loading={busy} disabled={!text.trim()} />
        ) : null}

        {error ? <Banner tone="info">{error}</Banner> : null}

        {analysis ? (
          <>
            <SectionTitle>Feedback</SectionTitle>
            <Card>
              <View style={styles.scoreRow}>
                <Chip label={`Overall: ${analysis.overallScore}/100`} tone={analysis.overallScore >= 65 ? "good" : analysis.overallScore >= 45 ? "warn" : "bad"} />
              </View>
              {analysis.strengths.map((s, i) => (
                <Text key={i} style={styles.strength}>✓ {s}</Text>
              ))}
            </Card>
            {analysis.issues.map((issue, i) => (
              <CorrectionCard
                key={i}
                correction={{
                  original: issue.original || "(general)",
                  corrected: issue.suggestion,
                  explanation: `${issue.type.toUpperCase()}: ${issue.explanation}`,
                  category: issue.type === "grammar" ? "structure" : "word_choice",
                  severity: issue.type === "grammar" ? "critical" : "improvement",
                }}
              />
            ))}
            <Card>
              <Text style={styles.revisedTitle}>Reference version</Text>
              <Text style={styles.revisedNote}>{analysis.dontAutoRewriteNote}</Text>
              <Text style={styles.revisedText}>{analysis.improvedVersion}</Text>
            </Card>
            <Button label="Write another" variant="secondary" onPress={() => { setAnalysis(null); setText(""); }} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    taskRow: { flexDirection: "row", gap: spacing.s, marginBottom: spacing.s, flexWrap: "wrap" },
    taskSelector: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.m },
    prompt: { ...type.h3, color: t.text },
    taskPrompt: { ...type.h3, color: t.text, marginBottom: spacing.m },
    input: {
      backgroundColor: t.background, borderRadius: 12, borderWidth: 1, borderColor: t.border,
      color: t.text, padding: spacing.m, fontSize: 15, minHeight: 160, textAlignVertical: "top",
    },
    wordCount: { ...type.small, color: t.textMuted, marginTop: spacing.s, textAlign: "right" },
    scoreRow: { marginBottom: spacing.s },
    strength: { ...type.body, color: t.success, marginBottom: 4 },
    revisedTitle: { ...type.h3, color: t.text, marginBottom: 4 },
    revisedNote: { ...type.small, color: t.warning, marginBottom: spacing.s, fontStyle: "italic" },
    revisedText: { ...type.body, color: t.text, lineHeight: 22 },
  });
