/**
 * Text analysis: measurable fluency and complexity metrics.
 * Every value here is computed from real input (transcripts, timings).
 * Nothing in this file fabricates data.
 */

export interface TextMetrics {
  words: number;
  sentences: number;
  /** words per minute; requires honest duration input. */
  wpm: number | null;
  /** type-token ratio (vocabulary diversity, 0-1). */
  diversity: number;
  /** average words per sentence. */
  avgSentenceLength: number;
  /** count of hesitation/filler tokens. */
  fillerCount: number;
  /** fillers per 100 words. */
  fillerRate: number;
  /** count of subordination/complexity markers. */
  complexityMarkers: number;
  /** longest gap between words in seconds (from recorder pause detection). */
  longestPauseSec?: number;
}

const FILLERS = [
  "um", "uh", "er", "ah", "hmm",
  "like", "you know", "i mean", "actually", "basically",
  "literally", "kind of", "sort of", "right?", "okay so", "so yeah",
];

const COMPLEXITY_MARKERS = [
  "because", "although", "though", "however", "therefore",
  "which", "whereas", "while", "since", "unless",
  "if", "when", "after", "before", "so that", "in order to",
  "not only", "as well as", "despite", "in spite of",
];

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function countPhrases(tokens: string[], phrases: string[]): number {
  let count = 0;
  for (const phrase of phrases) {
    const parts = phrase.split(" ");
    for (let i = 0; i <= tokens.length - parts.length; i++) {
      let match = true;
      for (let j = 0; j < parts.length; j++) {
        if (tokens[i + j] !== parts[j]) { match = false; break; }
      }
      if (match) count++;
    }
  }
  return count;
}

export interface AnalyzeInput {
  text: string;
  /** Real measured speaking duration in seconds, when available. */
  durationSec?: number;
  /** Real measured pause count / longest pause from the recorder. */
  pauseCount?: number;
  longestPauseSec?: number;
}

export function analyzeText(input: AnalyzeInput): TextMetrics {
  const tokens = tokenize(input.text);
  const words = tokens.length;
  const sentenceList = input.text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentences = Math.max(1, sentenceList.length);
  const unique = new Set(tokens).size;
  const fillerCount = countPhrases(tokens, FILLERS);
  const complexityMarkers = countPhrases(tokens, COMPLEXITY_MARKERS);
  const wpm =
    input.durationSec && input.durationSec > 0.5 && words > 0
      ? Math.round((words / input.durationSec) * 60)
      : null;
  return {
    words,
    sentences,
    wpm,
    diversity: words > 0 ? unique / words : 0,
    avgSentenceLength: Math.round((words / sentences) * 10) / 10,
    fillerCount,
    fillerRate: words > 0 ? Math.round((fillerCount / words) * 1000) / 10 : 0,
    complexityMarkers,
    longestPauseSec: input.longestPauseSec,
  };
}

/** Fluency verdict derived only from measured metrics (no invented numbers). */
export interface FluencyVerdict {
  band: "low" | "developing" | "steady" | "strong";
  reasons: string[];
}

export function fluencyVerdict(m: TextMetrics): FluencyVerdict {
  const reasons: string[] = [];
  let points = 0;
  if (m.wpm !== null) {
    if (m.wpm >= 110) { points += 2; reasons.push(`Speaking pace ${m.wpm} wpm is fluent.`); }
    else if (m.wpm >= 80) { points += 1; reasons.push(`Speaking pace ${m.wpm} wpm is reasonable.`); }
    else reasons.push(`Speaking pace ${m.wpm} wpm is slow; aim for 80-120 wpm.`);
  }
  if (m.fillerRate <= 2) points += 1;
  else reasons.push(`${m.fillerCount} filler word(s) detected; pausing silently is better than "um/uh".`);
  if (m.words >= 40) points += 1;
  else if (m.words > 0) reasons.push("Try to speak a little longer — 40+ words gives a better fluency picture.");
  if (m.avgSentenceLength >= 8) points += 1;
  if (m.complexityMarkers >= 2) points += 1;

  const band: FluencyVerdict["band"] =
    points >= 4 ? "strong" : points >= 3 ? "steady" : points >= 1 ? "developing" : "low";
  return { band, reasons };
}

/**
 * Word-level overlap between a target sentence and a recognition transcript.
 * HONEST heuristic: it reports which words were/weren't recognized by ASR.
 * This is NOT a pronunciation score — callers must label it as such.
 */
export interface WordRecognition {
  word: string;
  recognized: boolean;
}

export function wordRecognitionAgainstTarget(
  target: string,
  transcript: string,
): WordRecognition[] {
  const spoken = new Set(tokenize(transcript));
  return tokenize(target).map((word) => ({ word, recognized: spoken.has(word) }));
}
