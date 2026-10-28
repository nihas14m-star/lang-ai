/**
 * Conversation: scenario-driven talk with the tutor.
 * Corrections are recorded to the learner's mistake memory; vocabulary is
 * scheduled for review; retries are evaluated. Works offline via the
 * rule-based fallback (clearly labeled).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Input, Banner, Chip, SectionTitle } from "../components/ui";
import { ChatBubble, CorrectionCard, MicButton } from "../components/tutor";
import { useAppStore } from "../state/store";
import { useSpeechRecognition } from "../voice/asr";
import { speak, stopSpeaking, speakingNow } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { api, ApiError } from "../core/api";
import { localTutorTurn } from "../ai/localTutor";
import { SCENARIOS } from "../../../shared/src/scenarios";
import type { ScenarioDescriptorT, TutorTurnResponseT, CorrectionT } from "../../../shared/src/contracts";
import { sessionsRepo } from "../data/repos";

interface Turn extends ChatTurnLike {
  corrections?: CorrectionT[];
  meta?: string;
}
interface ChatTurnLike { role: "user" | "tutor"; content: string }

export default function Conversation() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const asr = useSpeechRecognition();

  const [scenario, setScenario] = useState<ScenarioDescriptorT | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCorrections, setLastCorrections] = useState<CorrectionT[]>([]);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const startScenario = useCallback(async (s: ScenarioDescriptorT) => {
    setScenario(s);
    const id = await sessionsRepo.start("conversation", s.id);
    setSessionId(id);
    setTurns([]);
    setLastCorrections([]);
    setRetryFeedback(null);
  }, []);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy || !scenario || !sessionId) return;
    setDraft("");
    asr.reset();
    setBusy(true);
    setRetryFeedback(null);
    const history: ChatTurnLike[] = turns.slice(-10).map(({ role, content }) => ({ role, content }));
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    await sessionsRepo.addMessage(sessionId, "user", message);
    scrollToEnd();

    let response: TutorTurnResponseT;
    try {
      const learner = await store.snapshot();
      response = await api.tutorTurn({
        sessionId,
        mode: "scenario",
        scenario,
        learner,
        history,
        message,
      });
    } catch (err) {
      if (err instanceof ApiError && err.kind !== "offline") {
        setTurns((prev) => [...prev, {
          role: "tutor",
          content: "I had trouble reaching the tutor service. Your message is saved — try again in a moment.",
          meta: "connection issue",
        }]);
        setBusy(false);
        return;
      }
      // Offline: rule-based fallback (honestly labeled)
      const learnerSnapshot = await store.snapshot().catch(() => undefined);
      response = localTutorTurn({
        sessionId, mode: "scenario", scenario,
        learner: learnerSnapshot ?? {
          name: "Learner", nativeLanguage: "unknown", cefrLevel: "B1", goals: [],
          skillScores: {}, weakAreas: [], activeMistakes: [], knownVocabulary: [],
        },
        history, message,
      });
    }

    setTurns((prev) => [...prev, {
      role: "tutor",
      content: response.reply,
      corrections: response.corrections,
      meta: response.meta ? providerLabel(response.meta.provider) : undefined,
    }]);
    await sessionsRepo.addMessage(sessionId, "tutor", response.reply, response.corrections, response.vocabulary);
    if (response.corrections.length > 0) {
      setLastCorrections(response.corrections);
      await store.recordCorrections(response.corrections, message);
      await store.recordSkillResult({
        skill: "grammar", correct: false, quality: 0.4,
        difficulty: scenario.difficulty, kind: "conversation",
      });
    } else {
      setLastCorrections([]);
      await store.recordSkillResult({
        skill: "grammar", correct: true, quality: 0.8,
        difficulty: scenario.difficulty, kind: "conversation",
      });
    }
    if (response.vocabulary.length > 0) {
      await store.recordVocabulary(response.vocabulary);
    }
    if (response.followUp) {
      setTurns((prev) => [...prev, { role: "tutor", content: response.followUp! }]);
    }
    if (response.scenarioProgress?.objectiveMet) {
      setTurns((prev) => [...prev, {
        role: "tutor",
        content: `🎉 Scenario complete! ${response.scenarioProgress!.progressNote}`,
      }]);
      await store.recordSkillResult({
        skill: "speaking", correct: true, quality: 0.9,
        difficulty: scenario.difficulty, kind: "conversation",
      });
    }
    setBusy(false);
    scrollToEnd();
    void speak(response.ttsText, { onDone: () => setSpeaking(false) });
    setSpeaking(true);
  };

  const retryLastCorrection = async () => {
    const correction = lastCorrections[0];
    if (!correction || !sessionId) return;
    setBusy(true);
    try {
      const learner = await store.snapshot();
      const result = await api.evaluate({
        kind: "retry",
        learner,
        prompt: "Say the corrected sentence",
        original: correction.original,
        response: draft.trim() || correction.corrected,
        history: [],
      });
      setRetryFeedback(result.feedback);
      await store.recordSkillResult({
        skill: "grammar", correct: result.correct, quality: result.score / 100,
        difficulty: scenario?.difficulty ?? "B1", kind: "retry",
      });
      if (result.correct) {
        await store.recordCorrections([], "");
      }
      if (draft.trim()) {
        await sessionsRepo.addMessage(sessionId, "user", draft.trim());
        setTurns((prev) => [...prev, { role: "user", content: draft.trim() }]);
        setDraft("");
      }
    } catch {
      setRetryFeedback("Retry evaluation needs the tutor service. Practice now, and it will sync when you reconnect.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Scenario picker ----
  if (!scenario) {
    return (
      <Screen title="Talk with your tutor" subtitle="Pick a situation to practice" onBack={() => router.back()}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {store.connection === "offline" ? (
            <Banner tone="warn">Offline: conversations use the built-in rule tutor until you reconnect.</Banner>
          ) : null}
          {SCENARIOS.map((s) => (
            <Card key={s.id} onPress={() => void startScenario(s)} accessibilityLabel={`Start scenario ${s.title}`}>
              <View style={styles.scenarioRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scenarioTitle}>{s.title}</Text>
                  <Text style={styles.scenarioDesc}>{s.description}</Text>
                </View>
                <Chip label={s.difficulty} tone={s.difficulty <= "A2" ? "good" : "default"} />
              </View>
            </Card>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  // ---- Chat ----
  return (
    <Screen title={scenario.title} subtitle={scenario.objective} onBack={() => { stopSpeaking(); setScenario(null); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.chatArea}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.l, paddingBottom: spacing.xl }}>
            <Card style={{ backgroundColor: theme.surfaceAlt }}>
              <Text style={styles.objective}>🎯 {scenario.objective}</Text>
              {scenario.targetVocabulary.length > 0 ? (
                <Text style={styles.vocabHint}>Try to use: {scenario.targetVocabulary.join(", ")}</Text>
              ) : null}
            </Card>
            {turns.map((turn, i) => (
              <View key={i}>
                <ChatBubble
                  role={turn.role}
                  content={turn.content}
                  meta={turn.meta}
                  onSpeak={turn.role === "tutor" ? () => {
                    if (speaking) { stopSpeaking(); setSpeaking(false); }
                    else void speak(turn.content, { onDone: () => setSpeaking(false) });
                  } : undefined}
                  speaking={speaking}
                />
                {turn.corrections?.map((c, j) => <CorrectionCard key={j} correction={c} />)}
              </View>
            ))}
            {retryFeedback ? <Banner tone={retryFeedback.includes("offline") ? "info" : "good"}>{retryFeedback}</Banner> : null}
            {busy ? <Text style={styles.typing}>Tutor is thinking…</Text> : null}
          </ScrollView>
        </View>

        <View style={styles.inputBar}>
          <MicButton
            listening={asr.listening}
            onPress={() => {
              if (asr.listening) {
                void asr.stopAndCollect().then((text) => { if (text) void send(text); });
              } else {
                void asr.start();
              }
            }}
            volume={asr.volume}
            accessibilityLabel="Speak your reply"
          />
          {asr.error ? <Text style={styles.asrError}>{asr.error}</Text> : null}
          {asr.transcript && asr.listening ? (
            <Text style={styles.liveTranscript}>{asr.transcript}</Text>
          ) : null}
          <View style={styles.inputRow}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your reply…"
              accessibilityLabel="Message input"
              style={{ flex: 1 }}
            />
            <Button label="Send" onPress={() => void send(draft)} disabled={!draft.trim() || busy} style={{ marginLeft: spacing.s }} />
          </View>
          {lastCorrections.length > 0 ? (
            <Button
              label="✓ I said it again — check my retry"
              variant="secondary"
              onPress={() => void retryLastCorrection()}
              disabled={busy}
              style={{ marginTop: spacing.s }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function providerLabel(provider: string): string {
  if (provider === "local-fallback" || provider === "offline") return "offline tutor";
  if (provider === "mock") return "rule-based tutor";
  return provider;
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    chatArea: { flex: 1 },
    objective: { ...type.small, color: t.text },
    vocabHint: { ...type.small, color: t.textMuted, marginTop: 4, fontStyle: "italic" },
    typing: { ...type.small, color: t.textMuted, fontStyle: "italic", paddingHorizontal: spacing.l },
    inputBar: { padding: spacing.l, backgroundColor: t.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    inputRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.s },
    asrError: { ...type.small, color: t.danger, textAlign: "center", marginTop: spacing.xs },
    liveTranscript: { ...type.small, color: t.accent, textAlign: "center", marginTop: spacing.xs },
    scenarioRow: { flexDirection: "row", alignItems: "center", gap: spacing.m },
    scenarioTitle: { ...type.h3, color: t.text },
    scenarioDesc: { ...type.small, color: t.textMuted, marginTop: 2 },
  });
