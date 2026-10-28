/**
 * Chat, feedback, and microphone components shared by conversation,
 * interview, and speaking screens.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, radius, type, useTheme, type Palette } from "../core/theme";
import type { CorrectionT } from "../../../shared/src/contracts";

export function ChatBubble(props: {
  role: "user" | "tutor";
  content: string;
  meta?: string;
  onSpeak?: () => void;
  speaking?: boolean;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const isUser = props.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && { justifyContent: "flex-end" }]}>
      <View
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleTutor]}
        accessibilityLabel={isUser ? "Your message" : "Tutor message"}
      >
        <Text style={[styles.bubbleText, { color: t.text }]}>{props.content}</Text>
        <View style={styles.bubbleFooter}>
          {props.meta ? <Text style={styles.bubbleMeta}>{props.meta}</Text> : null}
          {!isUser && props.onSpeak ? (
            <Pressable
              onPress={props.onSpeak}
              accessibilityRole="button"
              accessibilityLabel={props.speaking ? "Stop audio" : "Play audio"}
              hitSlop={8}
            >
              <Text style={styles.speakIcon}>{props.speaking ? "■" : "▶"}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const SEVERITY_LABEL: Record<CorrectionT["severity"], string> = {
  critical: "Fix this",
  improvement: "Better phrasing",
  note: "Good to know",
};

export function CorrectionCard(props: { correction: CorrectionT }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const toneColor =
    props.correction.severity === "critical" ? t.danger
      : props.correction.severity === "improvement" ? t.warning
        : t.accent;
  return (
    <View style={[styles.correctionCard, { borderLeftColor: toneColor }]} accessibilityLabel="Correction">
      <Text style={[styles.correctionKind, { color: toneColor }]}>
        {SEVERITY_LABEL[props.correction.severity]} · {props.correction.category.replace(/_/g, " ")}
      </Text>
      {props.correction.original !== props.correction.corrected ? (
        <Text style={styles.correctionLine}>
          <Text style={{ color: t.danger }}>{props.correction.original}</Text>
          {"  →  "}
          <Text style={{ color: t.success, fontWeight: "700" }}>{props.correction.corrected}</Text>
        </Text>
      ) : null}
      <Text style={styles.correctionExplanation}>{props.correction.explanation}</Text>
    </View>
  );
}

export function MicButton(props: {
  listening: boolean;
  disabled?: boolean;
  onPress: () => void;
  volume?: number;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const scale = props.listening ? 1 + Math.min(0.35, Math.max(0, (props.volume ?? 0)) / 25) : 1;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? (props.listening ? "Stop recording" : "Start recording")}
      accessibilityState={{ busy: props.listening }}
      style={[styles.micButton, props.listening && styles.micButtonActive, props.disabled && { opacity: 0.4 }, { transform: [{ scale }] }]}
    >
      <Text style={styles.micIcon}>{props.listening ? "■" : "🎙"}</Text>
      <Text style={styles.micLabel}>{props.listening ? "Stop" : "Speak"}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    bubbleRow: { flexDirection: "row", marginBottom: spacing.m, paddingHorizontal: 2 },
    bubble: {
      maxWidth: "85%", borderRadius: radius.l, paddingVertical: spacing.m,
      paddingHorizontal: spacing.l,
    },
    bubbleTutor: { backgroundColor: t.bubbleTutor, borderTopLeftRadius: 4 },
    bubbleUser: { backgroundColor: t.bubbleUser, borderTopRightRadius: 4 },
    bubbleText: { ...type.body, lineHeight: 21 },
    bubbleFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
    bubbleMeta: { ...type.small, color: t.textMuted, flex: 1 },
    speakIcon: { color: t.primary, fontSize: 15, padding: 4 },
    correctionCard: {
      backgroundColor: t.surface, borderRadius: radius.m, borderLeftWidth: 4,
      padding: spacing.m, marginBottom: spacing.s,
    },
    correctionKind: { ...type.small, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
    correctionLine: { ...type.body, marginBottom: 4 },
    correctionExplanation: { ...type.small, color: t.textMuted },
    micButton: {
      width: 84, height: 84, borderRadius: radius.round, backgroundColor: t.primary,
      alignItems: "center", justifyContent: "center", alignSelf: "center",
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
    },
    micButtonActive: { backgroundColor: t.danger },
    micIcon: { fontSize: 26 },
    micLabel: { ...type.small, color: t.primaryText, fontWeight: "600", marginTop: 2 },
  });
