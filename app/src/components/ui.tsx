/**
 * Reusable UI primitives.
 * All styling flows through the theme; screens compose these components so
 * the visual layer can be redesigned without touching business logic.
 */

import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { spacing, radius, type, useTheme, type Palette } from "../core/theme";

// ---------- Screen scaffold ----------

export function Screen(props: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const Body = props.scroll === false ? View : ScrollView;
  return (
    <View style={styles.screen} testID={props.testID}>
      {(props.title || props.onBack) && (
        <View style={styles.header}>
          {props.onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={props.onBack}
              style={styles.backButton}
            >
              <Text style={{ color: t.primary, fontSize: 22 }}>‹</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            {props.title ? <Text style={styles.headerTitle}>{props.title}</Text> : null}
            {props.subtitle ? <Text style={styles.headerSubtitle}>{props.subtitle}</Text> : null}
          </View>
        </View>
      )}
      <Body style={props.scroll === false ? { flex: 1 } : styles.scrollBody}>
        {props.children}
      </Body>
    </View>
  );
}

// ---------- Cards / sections ----------

export function Card(props: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, props.style]}
      >
        {props.children}
      </Pressable>
    );
  }
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function SectionTitle(props: { children: React.ReactNode; action?: React.ReactNode }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{props.children}</Text>
      {props.action}
    </View>
  );
}

export function Chip(props: { label: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const tone = props.tone ?? "default";
  return (
    <View style={[styles.chip, styles[`chip_${tone}`]]}>
      <Text style={[styles.chipText, styles[`chipText_${tone}`]]}>{props.label}</Text>
    </View>
  );
}

// ---------- Buttons ----------

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const variant = props.variant ?? "primary";
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: props.disabled || props.loading }}
      style={({ pressed }) => [
        styles.button, styles[`button_${variant}`],
        (props.disabled || props.loading) && styles.buttonDisabled,
        pressed && { opacity: 0.85 },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={variant === "primary" ? t.primaryText : t.primary} />
      ) : (
        <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>{props.label}</Text>
      )}
    </Pressable>
  );
}

// ---------- Inputs ----------

export function Input(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "email-address";
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={t.textMuted}
      accessibilityLabel={props.accessibilityLabel}
      multiline={props.multiline}
      keyboardType={props.keyboardType}
      testID={props.testID}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

// ---------- Progress / feedback ----------

export function ProgressBar(props: { value: number; accessibilityLabel?: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const pct = Math.max(0, Math.min(1, props.value));
  return (
    <View
      style={styles.progressTrack}
      accessible
      accessibilityLabel={props.accessibilityLabel ?? `Progress ${Math.round(pct * 100)} percent`}
    >
      <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
    </View>
  );
}

export function Banner(props: { tone: "info" | "warn" | "bad" | "good"; children: React.ReactNode }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const bg = props.tone === "warn" ? t.warning : props.tone === "bad" ? t.danger : props.tone === "good" ? t.success : t.accent;
  return (
    <View style={[styles.banner, { backgroundColor: bg + "22", borderColor: bg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.bannerText, { color: bg }]}>{props.children}</Text>
    </View>
  );
}

export function EmptyState(props: { title: string; message?: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{props.title}</Text>
      {props.message ? <Text style={styles.emptyMessage}>{props.message}</Text> : null}
    </View>
  );
}

export function Center(props: { children: React.ReactNode }) {
  return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>{props.children}</View>;
}

// ---------- Styles ----------

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: spacing.s,
      paddingHorizontal: spacing.l, paddingTop: spacing.xl, paddingBottom: spacing.m,
    },
    backButton: { width: 36, height: 36, borderRadius: radius.round, alignItems: "center", justifyContent: "center", backgroundColor: t.surface },
    headerTitle: { ...type.title, color: t.text },
    headerSubtitle: { ...type.small, color: t.textMuted, marginTop: 2 },
    scrollBody: { paddingHorizontal: spacing.l, paddingBottom: 48 },
    card: {
      backgroundColor: t.surface, borderRadius: radius.l, padding: spacing.l,
      borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, marginBottom: spacing.m,
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.m, marginBottom: spacing.s },
    sectionTitle: { ...type.h3, color: t.text },
    chip: { borderRadius: radius.round, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: t.surfaceAlt, alignSelf: "flex-start" },
    chip_default: { backgroundColor: t.surfaceAlt },
    chip_good: { backgroundColor: t.success + "22" },
    chip_warn: { backgroundColor: t.warning + "22" },
    chip_bad: { backgroundColor: t.danger + "22" },
    chipText: { ...type.small, color: t.textMuted },
    chipText_default: { color: t.textMuted },
    chipText_good: { color: t.success },
    chipText_warn: { color: t.warning },
    chipText_bad: { color: t.danger },
    button: {
      borderRadius: radius.m, paddingVertical: 14, paddingHorizontal: 20,
      alignItems: "center", justifyContent: "center", minHeight: 48,
    },
    button_primary: { backgroundColor: t.primary },
    button_secondary: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border },
    button_danger: { backgroundColor: t.danger },
    button_ghost: { backgroundColor: "transparent" },
    buttonDisabled: { opacity: 0.5 },
    buttonLabel: { ...type.h3, color: t.primaryText },
    buttonLabel_primary: { color: t.primaryText },
    buttonLabel_secondary: { color: t.primary },
    buttonLabel_danger: { color: "#FFFFFF" },
    buttonLabel_ghost: { color: t.primary },
    input: {
      backgroundColor: t.surface, borderRadius: radius.m, borderWidth: 1,
      borderColor: t.border, color: t.text, paddingHorizontal: spacing.m,
      paddingVertical: 12, fontSize: 15,
    },
    inputMultiline: { minHeight: 100, textAlignVertical: "top" },
    progressTrack: { backgroundColor: t.surfaceAlt, height: 8, borderRadius: radius.round, overflow: "hidden" },
    progressFill: { backgroundColor: t.primary, height: 8, borderRadius: radius.round },
    banner: { borderRadius: radius.m, borderWidth: 1, padding: spacing.m, marginBottom: spacing.m },
    bannerText: { ...type.small, fontWeight: "600" },
    empty: { alignItems: "center", padding: spacing.xxl },
    emptyTitle: { ...type.h3, color: t.text, marginBottom: spacing.s },
    emptyMessage: { ...type.small, color: t.textMuted, textAlign: "center" },
  });
