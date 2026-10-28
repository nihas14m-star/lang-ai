/**
 * Vocabulary: saved words with SRS status + live lookup via the backend
 * (Free Dictionary API first, AI fallback).
 */

import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Screen, Card, Button, Input, Banner, Chip, EmptyState, SectionTitle } from "../components/ui";
import { useAppStore } from "../state/store";
import { vocabRepo, type VocabRow } from "../data/repos";
import { spacing, type, useTheme } from "../core/theme";
import { api } from "../core/api";
import { isDue } from "../../../shared/src/srs";
import type { VocabItemT } from "../../../shared/src/contracts";

export default function Vocabulary() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const store = useAppStore();
  const [words, setWords] = useState<VocabRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState<{ found: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    void vocabRepo.all().then(setWords);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void store.refreshData();
    }, [refresh, store]),
  );

  const search = async () => {
    const word = query.trim().toLowerCase();
    if (!word || busy) return;
    setBusy(true);
    setLookup(null);
    try {
      const learner = await store.snapshot();
      const result = await api.vocabulary({ word, learner });
      if (result.found && result.item) {
        const item: VocabItemT = result.item;
        await store.recordVocabulary([item]);
        refresh();
        setLookup({
          found: true,
          text: `${item.word}${item.partOfSpeech ? ` (${item.partOfSpeech})` : ""}${item.pronunciation ? ` ${item.pronunciation}` : ""}\n${item.meaning}${item.example ? `\n\nExample: "${item.example}"` : ""}${result.learnerHint ? `\n\n${result.learnerHint}` : ""}`,
        });
      } else {
        setLookup({ found: false, text: result.learnerHint ?? "Word not found. Check the spelling or try again when connected." });
      }
    } catch (err) {
      setLookup({ found: false, text: err instanceof Error ? `${err.message} Word lookup needs a connection.` : "Lookup failed." });
    } finally {
      setBusy(false);
      setQuery("");
    }
  };

  const dueCount = words.filter((w) => isDue(w.srs, Date.now())).length;

  return (
    <Screen title="Vocabulary" subtitle={`${words.length} saved · ${dueCount} due for review`} onBack={() => router.back()}>
      <FlatList
        data={words}
        keyExtractor={(w) => w.word}
        contentContainerStyle={{ paddingBottom: 48 }}
        ListHeaderComponent={
          <>
            <Card>
              <View style={{ flexDirection: "row", gap: spacing.s, alignItems: "center" }}>
                <Input
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Look up a word…"
                  accessibilityLabel="Word lookup"
                  style={{ flex: 1 }}
                />
                <Button label="Add" onPress={() => void search()} loading={busy} disabled={!query.trim()} />
              </View>
              {lookup ? (
                <Banner tone={lookup.found ? "good" : "warn"}>{lookup.text}</Banner>
              ) : null}
            </Card>
            {dueCount > 0 ? (
              <Card onPress={() => router.push("/review")} accessibilityLabel="Start review session">
                <Text style={styles.reviewPrompt}>🔁 {dueCount} word(s) ready for review — tap to practice</Text>
              </Card>
            ) : null}
            <SectionTitle>Saved words</SectionTitle>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No words saved yet"
            message="Words your tutor teaches you in conversations are saved here automatically, or look one up above."
          />
        }
        renderItem={({ item }) => {
          const due = isDue(item.srs, Date.now());
          return (
            <Card>
              <View style={styles.wordHeader}>
                <Text style={styles.word}>{item.word}</Text>
                <Chip label={due ? "due now" : `next: ${new Date(item.srs.dueAt).toLocaleDateString()}`} tone={due ? "warn" : "default"} />
              </View>
              <Text style={styles.meaning}>{item.meaning}</Text>
              {item.example ? <Text style={styles.example}>“{item.example}”</Text> : null}
              <View style={styles.wordMeta}>
                <Text style={styles.metaText}>reviewed {item.reviewCount}× · mastery {Math.round(item.mastery * 100)}%</Text>
                {item.pronunciation ? <Text style={styles.metaText}> {item.pronunciation}</Text> : null}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (t: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    reviewPrompt: { ...type.h3, color: t.primary },
    wordHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    word: { ...type.h3, color: t.text, textTransform: "capitalize" },
    meaning: { ...type.body, color: t.text },
    example: { ...type.small, color: t.accent, fontStyle: "italic", marginTop: 4 },
    wordMeta: { flexDirection: "row", gap: spacing.s, marginTop: 6 },
    metaText: { ...type.small, color: t.textMuted },
  });
