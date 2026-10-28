/**
 * Interview mode: realistic mock interviews with role-play, then a
 * structured report (grammar, clarity, structure, relevance, conciseness).
 */

import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Input, Banner, Chip, SectionTitle, ProgressBar } from "../components/ui";
import { ChatBubble, CorrectionCard, MicButton } from "../components/tutor";
import { useAppStore } from "../state/store";
import { useSpeechRecognition } from "../voice/asr";
import { speak, stopSpeaking } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { api } from "../core/api";
import { localTutorTurn } from "../ai/localTutor";
import { INTERVIEW_SCENARIOS } from "../../../shared/src/scenarios";
import type { InterviewReportResponseT, ScenarioDescriptorT } from "../../../shared/src/contracts";
import { sessionsRepo } from "../data/repos";

export default function Interview() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const asr = useSpeechRecognition();

  const [scenario, setScenario] = useState<ScenarioDescriptorT | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Array<{ role: "user" | "tutor"; content: string }>>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<InterviewReportResponseT | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const start = async (s: ScenarioDescriptorT) => {
    setScenario(s);
    const id = await sessionsRepo.start("interview", s.id);
    setSessionId(id);
    const opener = `Hello, welcome to your ${s.title.toLowerCase()}. I'll ask you a few questions — answer as you would in the real room. Let's begin: tell me about yourself.`;
    setTurns([{ role: "tutor", content: opener }]);
    setQuestionCount(1);
    void speak(opener, { onDone: () => setSpeaking(false) });
    setSpeaking(true);
  };

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const answer = async (text: string) => {
    const message = text.trim();
    if (!message || busy || !scenario || !sessionId) return;
    setDraft("");
    asr.reset();
    setBusy(true);

    const history = turns.slice(-10);
    const nextTurns: Array<{ role: "user" | "tutor"; content: string }> = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    await sessionsRepo.addMessage(sessionId, "user", message);
    scrollToEnd();

    // Interviewer follow-up: question or end after 5 answers.
    const isLast = questionCount >= 5;
    let replyText: string;
    try {
      const learner = await store.snapshot();
      const response = await api.tutorTurn({
        sessionId,
        mode: "interview",
        scenario: { ...scenario, objective: isLast ? `${scenario.objective}. This was the final question — thank the candidate and end the interview.` : scenario.objective },
        learner,
        history,
        message,
      });
      replyText = response.reply;
      if (response.corrections.length > 0) {
        await store.recordCorrections(response.corrections, message);
      }
    } catch {
      const learner = await store.snapshot().catch(() => undefined);
      const local = localTutorTurn({
        sessionId, mode: "interview", scenario,
        learner: learner ?? {
          name: "Learner", nativeLanguage: "unknown", cefrLevel: "B1", goals: [],
          skillScores: {}, weakAreas: [], activeMistakes: [], knownVocabulary: [],
        },
        history, message,
      });
      replyText = isLast ? "Thank you for your answers. That completes the interview — let's look at your report." : local.reply;
    }

    setTurns((prev) => [...prev, { role: "tutor", content: replyText }]);
    await sessionsRepo.addMessage(sessionId, "tutor", replyText);
    await store.recordSkillResult({
      skill: "speaking", correct: true, quality: 0.7,
      difficulty: scenario.difficulty, kind: "interview",
    });
    setQuestionCount((c) => c + 1);
    setBusy(false);
    scrollToEnd();
    void speak(replyText, { onDone: () => setSpeaking(false) });
    setSpeaking(true);
  };

  const generateReport = async () => {
    if (!scenario) return;
    setBusy(true);
    try {
      const learner = await store.snapshot();
      const result = await api.interviewReport({ learner, scenario, turns });
      setReport(result);
      const grammarDim = result.dimensions.find((d) => d.name === "grammar");
      if (grammarDim) {
        await store.recordSkillResult({
          skill: "grammar", correct: grammarDim.score >= 60, quality: grammarDim.score / 100,
          difficulty: scenario.difficulty, kind: "interview",
        });
      }
      await sessionsRepo.end(sessionId ?? "", result);
      setFinished(true);
    } catch {
      setReport(null);
      setFinished(true);
    } finally {
      setBusy(false);
    }
  };

  // ---- Scenario picker ----
  if (!scenario) {
    return (
      <Screen title="Mock interviews" subtitle="Practice real interview questions" onBack={() => router.back()}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {INTERVIEW_SCENARIOS.map((s) => (
            <Card key={s.id} onPress={() => void start(s)} accessibilityLabel={`Start ${s.title}`}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{s.title}</Text>
                  <Text style={styles.desc}>{s.description}</Text>
                </View>
                <Chip label={s.difficulty} />
              </View>
            </Card>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  // ---- Report ----
  if (finished) {
    return (
      <Screen title="Interview report" onBack={() => router.replace("/")}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {report ? (
            <>
              <Card>
                <Text style={styles.score}>{report.overallScore}/100</Text>
                <ProgressBar value={report.overallScore / 100} />
              </Card>
              <SectionTitle>Dimensions</SectionTitle>
              {report.dimensions.map((d, i) => (
                <Card key={i}>
                  <View style={styles.row}>
                    <Text style={styles.dimName}>{d.name}</Text>
                    <Chip label={`${d.score}/100`} tone={d.score >= 65 ? "good" : d.score >= 45 ? "warn" : "bad"} />
                  </View>
                  <Text style={styles.dimComment}>{d.comment}</Text>
                </Card>
              ))}
              <SectionTitle>Strengths</SectionTitle>
              <Card>
                {report.strengths.map((s, i) => <Text key={i} style={styles.listItem}>✓ {s}</Text>)}
              </Card>
              <SectionTitle>Improve next time</SectionTitle>
              <Card>
                {report.improvements.map((s, i) => <Text key={i} style={styles.listItem}>→ {s}</Text>)}
              </Card>
              {report.suggestedAnswer ? (
                <Card>
                  <Text style={styles.dimName}>Model answer for your weakest question</Text>
                  <Text style={styles.modelAnswer}>{report.suggestedAnswer}</Text>
                </Card>
              ) : null}
            </>
          ) : (
            <Banner tone="warn">
              The interview report needs the tutor service. Your answers are saved — reconnect and run another interview for a full evaluation.
            </Banner>
          )}
          <Button label="Back to home" onPress={() => router.replace("/")} />
        </ScrollView>
      </Screen>
    );
  }

  // ---- Live interview ----
  return (
    <Screen
      title={scenario.title}
      subtitle={`Question ${Math.min(questionCount, 5)} of 5`}
      onBack={() => { stopSpeaking(); setScenario(null); }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.l, paddingBottom: spacing.xl }}>
            {turns.map((turn, i) => (
              <ChatBubble
                key={i}
                role={turn.role}
                content={turn.content}
                onSpeak={turn.role === "tutor" ? () => {
                  if (speaking) { stopSpeaking(); setSpeaking(false); }
                  else void speak(turn.content, { onDone: () => setSpeaking(false) });
                } : undefined}
                speaking={speaking}
              />
            ))}
            {busy ? <Text style={styles.thinking}>Interviewer is listening…</Text> : null}
          </ScrollView>
        </View>
        <View style={styles.inputBar}>
          <MicButton
            listening={asr.listening}
            onPress={() => {
              if (asr.listening) {
                asr.stop();
                const text = (asr.finalTranscript || asr.transcript).trim();
                if (text) void answer(text);
              } else void asr.start();
            }}
            volume={asr.volume}
            accessibilityLabel="Speak your answer"
          />
          {asr.error ? <Text style={styles.asrError}>{asr.error}</Text> : null}
          {asr.listening && asr.transcript ? <Text style={styles.live}>{asr.transcript}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.s }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your answer…"
              accessibilityLabel="Answer input"
              style={{ flex: 1 }}
            />
            <Button label="Send" onPress={() => void answer(draft)} disabled={!draft.trim() || busy} style={{ marginLeft: spacing.s }} />
          </View>
          {questionCount > 5 ? (
            <Button label="Finish and get report" onPress={() => void generateReport()} loading={busy} style={{ marginTop: spacing.s }} />
          ) : (
            <Button label="End interview & get report" variant="secondary" onPress={() => void generateReport()} disabled={turns.filter((t) => t.role === "user").length === 0} style={{ marginTop: spacing.s }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.m },
    title: { ...type.h3, color: t.text },
    desc: { ...type.small, color: t.textMuted, marginTop: 2 },
    thinking: { ...type.small, color: t.textMuted, fontStyle: "italic", paddingHorizontal: spacing.l },
    asrError: { ...type.small, color: t.danger, textAlign: "center", marginTop: spacing.xs },
    live: { ...type.small, color: t.accent, textAlign: "center", marginTop: spacing.xs },
    inputBar: { padding: spacing.l, backgroundColor: t.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    score: { ...type.title, fontSize: 40, color: t.primary, textAlign: "center", marginBottom: spacing.m },
    dimName: { ...type.h3, color: t.text, textTransform: "capitalize", flex: 1 },
    dimComment: { ...type.small, color: t.textMuted, marginTop: 4 },
    listItem: { ...type.body, color: t.text, marginBottom: 4 },
    modelAnswer: { ...type.body, color: t.text, lineHeight: 22, marginTop: spacing.s },
  });
