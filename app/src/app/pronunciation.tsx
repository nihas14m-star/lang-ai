/**
 * Pronunciation practice.
 * HONESTY FIRST: this build has no phoneme-level pronunciation service.
 * What we CAN do (and label truthfully):
 *  - play a target word/sentence (TTS, on-device)
 *  - run speech recognition on the learner's attempt
 *  - show which words the recognizer heard vs. missed (a hint, NOT a score)
 */

import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen, Card, Button, Banner, Chip, Input, SectionTitle } from "../components/ui";
import { MicButton } from "../components/tutor";
import { useAppStore } from "../state/store";
import { useSpeechRecognition } from "../voice/asr";
import { speak } from "../voice/tts";
import { spacing, type, useTheme } from "../core/theme";
import { wordRecognitionAgainstTarget } from "../../../shared/src/analysis";

const TRICKY_WORDS = [
  { word: "comfortable", note: "Often 3 syllables in natural speech: COMF-tər-bəl." },
  { word: "vegetable", note: "VEJ-tə-bəl — the middle 'e' is usually silent." },
  { word: "Wednesday", note: "WENZ-day — the first 'd' is silent." },
  { word: "schedule", note: "SKED-jool (US) or SHED-yool (UK)." },
  { word: "develop", note: "di-VEL-əp — stress on the second syllable." },
  { word: "colleague", note: "KOL-eeg — rhymes with 'league'." },
  { word: "through", note: "THROO — silent letters galore." },
  { word: "world", note: "WORLD — practice the 'rl' blend slowly." },
];

export default function Pronunciation() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const asr = useSpeechRecognition();
  const [target, setTarget] = useState("comfortable");
  const [attempted, setAttempted] = useState(false);

  const recognition = attempted && (asr.finalTranscript || asr.transcript)
    ? wordRecognitionAgainstTarget(target, asr.finalTranscript || asr.transcript)
    : null;
  const missed = recognition?.filter((w) => !w.recognized) ?? [];
  const heard = recognition?.filter((w) => w.recognized) ?? [];

  const startAttempt = () => {
    setAttempted(true);
    void asr.start();
  };

  const stopAttempt = () => {
    asr.stop();
  };

  return (
    <Screen title="Pronunciation" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Banner tone="info">
          This screen gives recognition-based practice hints. It does not measure phoneme-level
          pronunciation accuracy — that requires a dedicated pronunciation service.
        </Banner>

        <SectionTitle>Practice a word</SectionTitle>
        <Card>
          <Input
            value={target}
            onChangeText={(v) => { setTarget(v); setAttempted(false); asr.reset(); }}
            placeholder="Type a word or sentence"
            accessibilityLabel="Target word or sentence"
          />
          <View style={styles.buttonRow}>
            <Button label="▶ Hear it" variant="secondary" onPress={() => speak(target, { rate: 0.8 })} style={{ flex: 1 }} />
            <Button label="▶ Slower" variant="secondary" onPress={() => speak(target, { rate: 0.6 })} style={{ flex: 1 }} />
          </View>

          <View style={{ marginTop: spacing.l, alignItems: "center" }}>
            <MicButton
              listening={asr.listening}
              onPress={() => (asr.listening ? stopAttempt() : startAttempt())}
              volume={asr.volume}
              accessibilityLabel="Say the word"
            />
            <Text style={styles.hint}>
              {asr.listening ? "Listening… say the word clearly, then stop." : "Tap speak, say the word, then stop."}
            </Text>
          </View>

          {asr.error ? <Banner tone="warn">{asr.error}</Banner> : null}
          {asr.supported === false ? (
            <Banner tone="warn">Speech recognition is not available on this device. You can still listen and repeat.</Banner>
          ) : null}

          {recognition ? (
            <View style={{ marginTop: spacing.l }}>
              <Text style={styles.heardTitle}>What the recognizer heard:</Text>
              <View style={styles.wordWrap}>
                {recognition.map((w, i) => (
                  <Chip key={i} label={w.word} tone={w.recognized ? "good" : "bad"} />
                ))}
              </View>
              {heard.length > 0 ? (
                <Text style={styles.heardNote}>✓ Recognized: {heard.map((w) => w.word).join(", ")}</Text>
              ) : null}
              {missed.length > 0 ? (
                <>
                  <Text style={styles.missedNote}>
                    ✗ Not recognized: {missed.map((w) => w.word).join(", ")}. Try again slowly — this often
                    means the sounds were unclear to the recognizer. It's a hint, not a pronunciation score.
                  </Text>
                  <Button label="Try again" variant="secondary" onPress={() => { asr.reset(); setAttempted(false); }} style={{ marginTop: spacing.m }} />
                </>
              ) : (
                <Text style={styles.goodNote}>All words were recognized clearly. Well done!</Text>
              )}
            </View>
          ) : null}
        </Card>

        <SectionTitle>Commonly tricky words</SectionTitle>
        {TRICKY_WORDS.map((entry) => (
          <Card key={entry.word} onPress={() => { setTarget(entry.word); setAttempted(false); asr.reset(); }} accessibilityLabel={`Practice ${entry.word}`}>
            <View style={styles.row}>
              <Text style={styles.trickyWord}>{entry.word}</Text>
              <Button label="▶" variant="ghost" onPress={() => speak(entry.word, { rate: 0.8 })} />
            </View>
            <Text style={styles.trickyNote}>{entry.note}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    buttonRow: { flexDirection: "row", gap: spacing.s, marginTop: spacing.m },
    hint: { ...type.small, color: t.textMuted, textAlign: "center", marginTop: spacing.s },
    heardTitle: { ...type.h3, color: t.text, marginBottom: spacing.s },
    wordWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    heardNote: { ...type.small, color: t.success, marginTop: spacing.s },
    missedNote: { ...type.small, color: t.warning, marginTop: spacing.s, lineHeight: 18 },
    goodNote: { ...type.small, color: t.success, marginTop: spacing.s },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    trickyWord: { ...type.h3, color: t.text },
    trickyNote: { ...type.small, color: t.textMuted, marginTop: 2 },
  });
