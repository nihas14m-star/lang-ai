/**
 * Text-to-speech via expo-speech.
 * Conversational pacing: tutor replies are spoken slightly slower for
 * lower CEFR levels; explanations are never auto-spoken in full.
 */

import * as Speech from "expo-speech";
import type { CefrLevel } from "../../../shared/src/cefr";

let currentVoiceUri: string | undefined;

export async function loadVoices(): Promise<Speech.Voice[]> {
  try {
    return await Speech.getAvailableVoicesAsync();
  } catch {
    return [];
  }
}

export async function listEnglishVoices(): Promise<Speech.Voice[]> {
  const voices = await loadVoices();
  return voices.filter((v) => v.language.startsWith("en"));
}

export function setPreferredVoice(voiceUri?: string): void {
  currentVoiceUri = voiceUri;
}

/** Speaking rate adapted to level: beginners hear slower, clearer speech. */
export function rateForLevel(level: CefrLevel): number {
  switch (level) {
    case "A1": return 0.85;
    case "A2": return 0.9;
    case "B1": return 0.95;
    default: return 1.0;
  }
}

export function speak(
  text: string,
  options: { level?: CefrLevel; rate?: number; onDone?: () => void; onError?: () => void } = {},
): void {
  if (!text.trim()) return;
  Speech.stop();
  Speech.speak(text, {
    language: "en-US",
    rate: options.rate ?? (options.level ? rateForLevel(options.level) : 0.95),
    pitch: 1.0,
    voice: currentVoiceUri,
    onDone: options.onDone,
    onError: options.onError,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export async function speakingNow(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
