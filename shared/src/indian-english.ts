/**
 * Indian English awareness.
 * The learner may naturally use Indian English. We never treat it as "wrong"
 * by default. Each entry explains the international variant respectfully so
 * the learner can choose the right register for their audience.
 */

export type UsageKind =
  | /** Universally treated as nonstandard — worth correcting everywhere. */ "commonly-corrected"
  /** Standard in Indian English; note for international contexts. */ | "variant";

export interface IndianEnglishEntry {
  id: string;
  re: RegExp;
  kind: UsageKind;
  usage: string;
  international: string;
  note: string;
}

export const INDIAN_ENGLISH_ENTRIES: IndianEnglishEntry[] = [
  { id: "prepone", re: /\bprepone\w*\b/i, kind: "variant", usage: "prepone", international: "move (it) earlier / bring forward", note: "Widely understood in India; internationally you'd say \"let's move the meeting earlier\"." },
  { id: "do-the-needful", re: /\bdo the needful\b/i, kind: "variant", usage: "do the needful", international: "please do what is needed / please take care of this", note: "Classic Indian English; outside India it can sound old-fashioned." },
  { id: "kindly", re: /\bkindly\b/i, kind: "variant", usage: "kindly send the file", international: "please send the file", note: "Correct but formal; \"please\" is the everyday international choice." },
  { id: "out-of-station", re: /\bout of station\b/i, kind: "variant", usage: "I am out of station", international: "I am out of town", note: "Indian English usage; \"out of town\" is the international equivalent." },
  { id: "passout", re: /\bpass(?:ed)? ?out\b/i, kind: "variant", usage: "I passed out in 2023", international: "I graduated in 2023", note: "In international English \"pass out\" means to faint — say \"graduated\" to avoid confusion." },
  { id: "years-back", re: /\b\d+ years? back\b/i, kind: "variant", usage: "5 years back", international: "5 years ago", note: "\"Ago\" is the international standard; \"back\" is common in Indian English." },
  { id: "batchmates", re: /\bbatch ?mates?\b/i, kind: "variant", usage: "my batchmates", international: "my classmates", note: "Understood in India; \"classmates\" is more universal." },
  { id: "good-name", re: /\bwhat is your good name\b/i, kind: "variant", usage: "What is your good name?", international: "What is your name?", note: "Polite Indian English; internationally just \"What's your name?\"." },
  { id: "only-emphasis", re: /\b(i|he|she|we|they)\s+\w+\s+\w+\s+only\b/i, kind: "variant", usage: "He lives there only", international: "He lives right there / He lives just there", note: "Sentence-final \"only\" for emphasis is Indian English; internationally use \"right/just\"." },
  { id: "itself-emphasis", re: /\b\w+\s+itself\b/i, kind: "variant", usage: "Today itself", international: "today itself → today / as early as today", note: "Emphatic \"itself\" is Indian English." },
  { id: "eat-my-brain", re: /\b(eat|eating|ate) (my|his|her|their) (brain|head)\b/i, kind: "variant", usage: "He is eating my brain", international: "He is annoying me / getting on my nerves", note: "Colorful Indian English; not understood internationally." },
  { id: "revert-back", re: /\brevert back\b/i, kind: "variant", usage: "Kindly revert back", international: "please reply", note: "In international English \"revert\" means \"return to a previous state\"; \"reply\" is clearer for emails." },
  { id: "today-morning", re: /\btoday (morning|evening|afternoon|night)\b/i, kind: "commonly-corrected", usage: "today morning", international: "this morning", note: "English pairs this/these with parts of the day; \"yesterday night\" → \"last night\"." },
];

export interface UsageNote {
  id: string;
  kind: UsageKind;
  message: string;
}

/** Scan text for Indian English usages (respectful, informational). */
export function scanIndianEnglish(text: string): UsageNote[] {
  const notes: UsageNote[] = [];
  for (const e of INDIAN_ENGLISH_ENTRIES) {
    if (e.re.test(text)) {
      notes.push({
        id: e.id,
        kind: e.kind,
        message:
          e.kind === "variant"
            ? `You said "${e.usage}" — that's natural Indian English. In international contexts you might hear "${e.international}". ${e.note}`
            : `Small fix: "${e.usage}" → "${e.international}". ${e.note}`,
      });
    }
  }
  return notes;
}
