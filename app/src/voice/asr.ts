/**
 * Speech recognition (ASR) via expo-speech-recognition.
 * Also derives HONEST fluency metrics from the volume timeline:
 *  - speaking duration (from audiostart/audioend timestamps)
 *  - pause count and longest pause (gaps where volume <= 0 for >= 500ms)
 * These are real measurements, not estimates.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export interface SpeechMetrics {
  durationSec?: number;
  pauseCount?: number;
  longestPauseSec?: number;
}

export interface AsrState {
  supported: boolean | "unknown";
  listening: boolean;
  transcript: string;
  finalTranscript: string;
  error: string | null;
  permissionDenied: boolean;
  metrics: SpeechMetrics;
  volume: number;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const PAUSE_THRESHOLD_MS = 500;
const INAUDIBLE = 0; // volumechange value <= 0 means inaudible

export function useSpeechRecognition(lang = "en-US"): AsrState {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [metrics, setMetrics] = useState<SpeechMetrics>({});
  const [volume, setVolume] = useState(0);
  const [supported, setSupported] = useState<boolean | "unknown">("unknown");

  // Volume timeline for pause detection.
  const volumeEvents = useRef<Array<{ t: number; v: number }>>([]);
  const audioStart = useRef<number | null>(null);
  const audioEnd = useRef<number | null>(null);
  const finals = useRef<string[]>([]);
  const lastPartial = useRef("");

  useEffect(() => {
    try {
      const avail = ExpoSpeechRecognitionModule.isRecognitionAvailable?.();
      setSupported(typeof avail === "boolean" ? avail : "unknown");
    } catch {
      setSupported("unknown");
    }
  }, []);

  useSpeechRecognitionEvent("start", () => {
    setListening(true);
    setError(null);
    volumeEvents.current = [];
  });

  useSpeechRecognitionEvent("audiostart", (event) => {
    audioStart.current = event.timestamp ?? Date.now();
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    audioEnd.current = event.timestamp ?? Date.now();
  });

  useSpeechRecognitionEvent("speechstart", () => {
    volumeEvents.current.push({ t: Date.now(), v: 5 });
  });

  useSpeechRecognitionEvent("volumechange", (event) => {
    setVolume(event.value);
    volumeEvents.current.push({ t: Date.now(), v: event.value });
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    lastPartial.current = text;
    setTranscript(text);
    if (event.isFinal) {
      finals.current.push(text);
      setFinalTranscript(finals.current.join(" ").trim());
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted") return; // user-initiated
    if (event.error === "not-allowed") setPermissionDenied(true);
    const messages: Record<string, string> = {
      "no-speech": "I didn't hear anything. Try speaking a bit louder.",
      "network": "Speech recognition needs a network connection on this device.",
      "service-not-allowed": "Speech recognition is not available on this device.",
      "not-allowed": "Microphone permission is needed for speaking practice.",
      "speech-timeout": "You paused for a while. Tap the mic and try again.",
      "audio-capture": "Microphone problem. Check that no other app is using it.",
    };
    setError(messages[event.error] ?? `Speech recognition error: ${event.error}`);
    setListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    // Compute metrics from the real volume timeline.
    const end = audioEnd.current ?? Date.now();
    const start = audioStart.current ?? end;
    const durationSec = audioStart.current ? Math.max(0.5, (end - start) / 1000) : undefined;

    const events = volumeEvents.current;
    let pauseCount = 0;
    let longestPauseMs = 0;
    let silenceStart: number | null = null;
    let lastAudible: number | null = null;
    for (const e of events) {
      if (e.v <= INAUDIBLE) {
        if (silenceStart === null) silenceStart = e.t;
      } else {
        if (silenceStart !== null) {
          const gap = e.t - silenceStart;
          if (gap >= PAUSE_THRESHOLD_MS) {
            pauseCount++;
            longestPauseMs = Math.max(longestPauseMs, gap);
          }
          silenceStart = null;
        }
        lastAudible = e.t;
      }
    }
    // trailing silence before stop doesn't count as a pause
    setMetrics({
      durationSec,
      pauseCount,
      longestPauseSec: longestPauseMs > 0 ? Math.round((longestPauseMs / 1000) * 10) / 10 : undefined,
    });
    void lastAudible;
  });

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setFinalTranscript("");
    setMetrics({});
    finals.current = [];
    lastPartial.current = "";
    audioStart.current = null;
    audioEnd.current = null;
    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        setPermissionDenied(true);
        setError("Microphone permission is needed for speaking practice. Enable it in Settings.");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 200 },
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "web_search",
        },
      });
    } catch (err) {
      setSupported(false);
      setError(err instanceof Error ? err.message : "Could not start speech recognition.");
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
    setMetrics({});
    setError(null);
    finals.current = [];
  }, []);

  return {
    supported, listening, transcript, finalTranscript, error,
    permissionDenied, metrics, volume, start, stop, reset,
  };
}
