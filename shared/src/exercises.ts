/**
 * Built-in exercise bank: grammar drills that work fully OFFLINE.
 * Scoring is deterministic (no AI needed for these).
 */

import type { CefrLevel } from "./cefr";

export type DrillType = "choose" | "fill_blank" | "correct_sentence";

export interface Drill {
  id: string;
  topicId: string;
  level: CefrLevel;
  type: DrillType;
  prompt: string;
  /** For choose-type drills. */
  options?: string[];
  /** Accepted answer(s), lowercased. */
  answers: string[];
  explanation: string;
}

export const DRILLS: Drill[] = [
  // ---- present simple ----
  { id: "ps1", topicId: "present_simple", level: "A1", type: "choose", prompt: "She ___ to college every day.", options: ["go", "goes", "going"], answers: ["goes"], explanation: "Third person singular (she/he/it) takes -s in the present simple." },
  { id: "ps2", topicId: "present_simple", level: "A1", type: "choose", prompt: "I ___ up at 6 a.m. every day.", options: ["wake", "wakes", "waking"], answers: ["wake"], explanation: "\"I\" takes the base form: I wake." },
  { id: "ps3", topicId: "present_simple", level: "A1", type: "fill_blank", prompt: "My father ___ (work) in a bank.", answers: ["works"], explanation: "he/she/it + works." },
  { id: "ps4", topicId: "present_simple", level: "A1", type: "correct_sentence", prompt: "Correct this sentence: \"He don't like tea.\"", answers: ["he doesn't like tea", "he does not like tea"], explanation: "With he/she/it, use \"doesn't\"." },
  { id: "ps5", topicId: "present_simple", level: "A2", type: "choose", prompt: "Water ___ at 100°C.", options: ["boil", "boils", "is boiling"], answers: ["boils"], explanation: "Facts take the present simple." },
  // ---- present continuous ----
  { id: "pc1", topicId: "present_continuous", level: "A1", type: "choose", prompt: "Right now, I ___ a book.", options: ["read", "am reading", "reads"], answers: ["am reading"], explanation: "Action happening now: am/is/are + -ing." },
  { id: "pc2", topicId: "present_continuous", level: "A1", type: "fill_blank", prompt: "They ___ (play) cricket at the moment.", answers: ["are playing"], explanation: "They + are + playing." },
  { id: "pc3", topicId: "present_continuous", level: "A2", type: "correct_sentence", prompt: "Correct: \"I am knowing the answer.\"", answers: ["i know the answer"], explanation: "\"Know\" is a state verb — no continuous form." },
  // ---- past simple ----
  { id: "pa1", topicId: "past_simple", level: "A1", type: "choose", prompt: "Yesterday I ___ my friend at the market.", options: ["meet", "met", "meeted"], answers: ["met"], explanation: "\"Yesterday\" needs past simple: met." },
  { id: "pa2", topicId: "past_simple", level: "A1", type: "fill_blank", prompt: "Last night we ___ (eat) dinner at 8.", answers: ["ate"], explanation: "eat → ate." },
  { id: "pa3", topicId: "past_simple", level: "A2", type: "correct_sentence", prompt: "Correct: \"I go to Delhi last week.\"", answers: ["i went to delhi last week"], explanation: "\"Last week\" requires the past simple: went." },
  { id: "pa4", topicId: "past_simple", level: "A2", type: "choose", prompt: "She ___ the movie last Sunday.", options: ["didn't watched", "didn't watch", "not watched"], answers: ["didn't watch"], explanation: "After didn't, use the base form." },
  { id: "pa5", topicId: "past_simple", level: "A2", type: "fill_blank", prompt: "He ___ (buy) a new phone two days ago.", answers: ["bought"], explanation: "buy → bought." },
  // ---- articles ----
  { id: "ar1", topicId: "articles", level: "A1", type: "choose", prompt: "I saw ___ elephant at the zoo.", options: ["a", "an", "the"], answers: ["an"], explanation: "\"Elephant\" starts with a vowel sound → an." },
  { id: "ar2", topicId: "articles", level: "A1", type: "fill_blank", prompt: "She is ___ honest girl.", answers: ["an"], explanation: "\"Honest\" starts with a vowel SOUND (the h is silent) → an." },
  { id: "ar3", topicId: "articles", level: "A2", type: "choose", prompt: "___ sun rises in the east.", options: ["A", "An", "The"], answers: ["the"], explanation: "Unique things take \"the\"." },
  { id: "ar4", topicId: "articles", level: "A2", type: "correct_sentence", prompt: "Correct: \"I am reading the book you gave. I like a book.\"", answers: ["i like the book"], explanation: "The second mention refers to the same book → \"the book\"." },
  { id: "ar5", topicId: "articles", level: "B1", type: "choose", prompt: "He goes to ___ university in Chennai.", options: ["a", "an", "the", "(no article)"], answers: ["a"], explanation: "\"University\" starts with a /j/ (you) sound → \"a university\"." },
  { id: "ar6", topicId: "articles", level: "B1", type: "correct_sentence", prompt: "Correct: \"The honesty is important.\"", answers: ["honesty is important"], explanation: "Abstract uncountable nouns (honesty, advice) take no article." },
  // ---- prepositions ----
  { id: "pr1", topicId: "prepositions", level: "A2", type: "choose", prompt: "I will meet you ___ Monday.", options: ["in", "on", "at"], answers: ["on"], explanation: "Days take \"on\": on Monday." },
  { id: "pr2", topicId: "prepositions", level: "A2", type: "choose", prompt: "The meeting is ___ 3 p.m.", options: ["in", "on", "at"], answers: ["at"], explanation: "Clock times take \"at\"." },
  { id: "pr3", topicId: "prepositions", level: "A2", type: "fill_blank", prompt: "She was born ___ 2005.", answers: ["in"], explanation: "Years/months take \"in\"." },
  { id: "pr4", topicId: "prepositions", level: "B1", type: "correct_sentence", prompt: "Correct: \"I am waiting since two hours.\"", answers: ["i have been waiting for two hours"], explanation: "Duration uses \"for\" (+ present perfect continuous here)." },
  { id: "pr5", topicId: "prepositions", level: "B1", type: "choose", prompt: "Congratulations ___ your new job!", options: ["for", "on", "with"], answers: ["on"], explanation: "congratulate someone ON something." },
  // ---- subject-verb agreement ----
  { id: "sv1", topicId: "subject_verb_agreement", level: "A1", type: "correct_sentence", prompt: "Correct: \"My friends is coming tonight.\"", answers: ["my friends are coming tonight"], explanation: "Plural subject \"friends\" takes \"are\"." },
  { id: "sv2", topicId: "subject_verb_agreement", level: "A2", type: "choose", prompt: "Everyone ___ ready.", options: ["are", "is", "were"], answers: ["is"], explanation: "Everyone/everybody is singular." },
  { id: "sv3", topicId: "subject_verb_agreement", level: "B1", type: "correct_sentence", prompt: "Correct: \"The list of items are on the table.\"", answers: ["the list of items is on the table"], explanation: "The subject is \"the list\" (singular); \"of items\" is just detail." },
  // ---- countable/uncountable ----
  { id: "cu1", topicId: "countable_uncountable", level: "A2", type: "choose", prompt: "How ___ money do you need?", options: ["many", "much", "few"], answers: ["much"], explanation: "\"Money\" is uncountable → much." },
  { id: "cu2", topicId: "countable_uncountable", level: "A2", type: "correct_sentence", prompt: "Correct: \"She gave me many advices.\"", answers: ["she gave me a lot of advice", "she gave me much advice", "she gave me some advice"], explanation: "\"Advice\" is uncountable — no plural -s." },
  { id: "cu3", topicId: "countable_uncountable", level: "B1", type: "choose", prompt: "There are ___ students in the hall.", options: ["much", "many", "a lot"], answers: ["many"], explanation: "Countable plural → many." },
  // ---- future forms ----
  { id: "fu1", topicId: "future_forms", level: "A2", type: "choose", prompt: "Look at those clouds! It ___ rain.", options: ["will", "is going to", "rains"], answers: ["is going to"], explanation: "Present evidence → going to." },
  { id: "fu2", topicId: "future_forms", level: "A2", type: "choose", prompt: "I think our team ___ win.", options: ["will", "is going to", "wins"], answers: ["will"], explanation: "Opinions/predictions without evidence → will." },
  { id: "fu3", topicId: "future_forms", level: "B1", type: "correct_sentence", prompt: "Correct: \"I will to visit my uncle tomorrow.\"", answers: ["i will visit my uncle tomorrow"], explanation: "After \"will\", use the bare infinitive (no \"to\")." },
  // ---- past continuous ----
  { id: "pcon1", topicId: "past_continuous", level: "A2", type: "choose", prompt: "I ___ dinner when the phone rang.", options: ["cooked", "was cooking", "cook"], answers: ["was cooking"], explanation: "Longer background action → past continuous." },
  { id: "pcon2", topicId: "past_continuous", level: "A2", type: "fill_blank", prompt: "While she ___ (read), the lights went out.", answers: ["was reading"], explanation: "was + reading for the background action." },
  // ---- present perfect ----
  { id: "pp1", topicId: "present_perfect", level: "B1", type: "choose", prompt: "I ___ this movie three times.", options: ["saw", "have seen", "had seen"], answers: ["have seen"], explanation: "Experience up to now → present perfect." },
  { id: "pp2", topicId: "present_perfect", level: "B1", type: "correct_sentence", prompt: "Correct: \"I have seen him yesterday.\"", answers: ["i saw him yesterday"], explanation: "A finished time (yesterday) needs the past simple." },
  { id: "pp3", topicId: "present_perfect", level: "B1", type: "choose", prompt: "She ___ here since 2020.", options: ["works", "has worked", "worked"], answers: ["has worked"], explanation: "\"Since 2020\" (unfinished) → present perfect." },
  { id: "pp4", topicId: "present_perfect", level: "B2", type: "fill_blank", prompt: "We ___ (know) each other for ten years.", answers: ["have known"], explanation: "\"For ten years\" (still true) → present perfect." },
  // ---- comparatives ----
  { id: "co1", topicId: "comparatives", level: "A2", type: "choose", prompt: "This road is ___ than that one.", options: ["narrower", "more narrow", "narrowest"], answers: ["narrower"], explanation: "Two-syllable adjective: narrower (both forms exist, this is standard)." },
  { id: "co2", topicId: "comparatives", level: "A2", type: "correct_sentence", prompt: "Correct: \"Chennai is more bigger than Coimbatore.\"", answers: ["chennai is bigger than coimbatore"], explanation: "Never combine \"more\" with a comparative -er form." },
  { id: "co3", topicId: "comparatives", level: "B1", type: "choose", prompt: "It was ___ film I have ever watched.", options: ["the most interesting", "most interesting", "the interestinger"], answers: ["the most interesting"], explanation: "Superlative: the most + long adjective." },
  // ---- modals ----
  { id: "mo1", topicId: "modals", level: "A2", type: "choose", prompt: "You look tired. You ___ take some rest.", options: ["should", "must", "can"], answers: ["should"], explanation: "Advice → should." },
  { id: "mo2", topicId: "modals", level: "B1", type: "correct_sentence", prompt: "Correct: \"He cans swim very well.\"", answers: ["he can swim very well"], explanation: "Modals never take -s." },
  { id: "mo3", topicId: "modals", level: "B1", type: "choose", prompt: "You ___ submit the form before Friday — it's compulsory.", options: ["can", "must", "might"], answers: ["must"], explanation: "Obligation → must." },
  // ---- conditionals ----
  { id: "cd1", topicId: "conditionals", level: "B1", type: "choose", prompt: "If it rains tomorrow, we ___ the picnic.", options: ["cancel", "will cancel", "would cancel"], answers: ["will cancel"], explanation: "First conditional: if + present, will + verb." },
  { id: "cd2", topicId: "conditionals", level: "B1", type: "correct_sentence", prompt: "Correct: \"If I was you, I would apologize.\"", answers: ["if i were you, i would apologize"], explanation: "Second conditional advice: \"If I were you\"." },
  { id: "cd3", topicId: "conditionals", level: "B2", type: "choose", prompt: "If she ___ earlier, she wouldn't have missed the train.", options: ["left", "had left", "would leave"], answers: ["had left"], explanation: "Third conditional: if + past perfect, would have + participle." },
  // ---- phrasal verbs ----
  { id: "ph1", topicId: "phrasal_verbs", level: "B1", type: "choose", prompt: "The meeting was ___ due to the strike.", options: ["put off", "put on", "put up"], answers: ["put off"], explanation: "put off = postpone." },
  { id: "ph2", topicId: "phrasal_verbs", level: "B1", type: "fill_blank", prompt: "I couldn't ___ (tolerate) the noise, so I left. (2 words: phrasal verb)", answers: ["put up with"], explanation: "put up with = tolerate." },
  { id: "ph3", topicId: "phrasal_verbs", level: "B2", type: "choose", prompt: "I ran ___ an old friend at the airport.", options: ["into", "out of", "off"], answers: ["into"], explanation: "run into = meet by chance." },
  // ---- connectors ----
  { id: "cn1", topicId: "connectors", level: "B1", type: "choose", prompt: "He was tired; ___, he finished the assignment.", options: ["however", "therefore", "because"], answers: ["however"], explanation: "Contrast → however." },
  { id: "cn2", topicId: "connectors", level: "B1", type: "choose", prompt: "___ he studied hard, he didn't clear the exam.", options: ["Although", "Because", "So"], answers: ["Although"], explanation: "Contrast between clauses → although." },
  { id: "cn3", topicId: "connectors", level: "B2", type: "correct_sentence", prompt: "Correct: \"Despite of the traffic, we reached on time.\"", answers: ["despite the traffic, we reached on time", "in spite of the traffic, we reached on time"], explanation: "\"Despite\" never takes \"of\" (that's \"in spite of\")." },
  // ---- relative clauses ----
  { id: "rc1", topicId: "relative_clauses", level: "B1", type: "choose", prompt: "The engineer ___ fixed our AC was very polite.", options: ["who", "which", "whose"], answers: ["who"], explanation: "People → who." },
  { id: "rc2", topicId: "relative_clauses", level: "B1", type: "choose", prompt: "The app, ___ I use daily, is free.", options: ["that", "which", "who"], answers: ["which"], explanation: "Non-defining clause (after comma) → which, never that." },
  // ---- passive ----
  { id: "pv1", topicId: "passive_voice", level: "B2", type: "choose", prompt: "The results ___ announced tomorrow.", options: ["will be", "will", "are"], answers: ["will be"], explanation: "Passive future: will be + participle." },
  { id: "pv2", topicId: "passive_voice", level: "B2", type: "correct_sentence", prompt: "Make passive: \"They built this bridge in 1998.\"", answers: ["this bridge was built in 1998"], explanation: "Past passive: was/were + participle." },
  // ---- reported speech ----
  { id: "rs1", topicId: "reported_speech", level: "B2", type: "choose", prompt: "He said he ___ busy then.", options: ["is", "was", "will be"], answers: ["was"], explanation: "Reported speech backshifts present → past." },
  { id: "rs2", topicId: "reported_speech", level: "B2", type: "correct_sentence", prompt: "Correct: \"She told to me that she was ill.\"", answers: ["she told me that she was ill"], explanation: "\"Tell\" takes a direct object without \"to\" (say to me / tell me)." },
  // ---- word order ----
  { id: "wo1", topicId: "word_order", level: "A1", type: "correct_sentence", prompt: "Correct: \"I always am late.\"", answers: ["i am always late"], explanation: "With the verb \"be\", frequency adverbs come after it: \"I am always late\"." },
  { id: "wo2", topicId: "word_order", level: "A2", type: "correct_sentence", prompt: "Correct: \"I like very much this song.\"", answers: ["i like this song very much"], explanation: "English is SVO: verb + object + adverbial." },
  // ---- questions ----
  { id: "qf1", topicId: "question_formation", level: "A1", type: "correct_sentence", prompt: "Correct: \"Where you are going?\"", answers: ["where are you going"], explanation: "In questions, invert: are + you." },
  { id: "qf2", topicId: "question_formation", level: "A2", type: "correct_sentence", prompt: "Correct: \"What means this word?\"", answers: ["what does this word mean"], explanation: "Questions with a normal verb need do/does." },
  { id: "qf3", topicId: "question_formation", level: "B1", type: "choose", prompt: "Could you tell me where ___?", options: ["is the station", "the station is"], answers: ["the station is"], explanation: "Indirect questions keep statement word order." },
  // ---- register ----
  { id: "rg1", topicId: "register", level: "B1", type: "choose", prompt: "In a job interview, the most professional is:", options: ["Hey, what's up!", "Good morning. It's a pleasure to meet you.", "Yo!"], answers: ["good morning. it's a pleasure to meet you.", "good morning. it's a pleasure to meet you"], explanation: "Interviews call for formal register." },
  { id: "rg2", topicId: "register", level: "B1", type: "correct_sentence", prompt: "Make formal: \"Send me the report fast.\"", answers: ["could you please send me the report as soon as possible", "please send me the report as soon as possible", "could you please send me the report soon"], explanation: "Formal requests use \"could you please...\"." },
  // ---- storytelling ----
  { id: "st1", topicId: "storytelling", level: "B1", type: "choose", prompt: "When I arrived, the train ___ already left.", options: ["has", "had", "have"], answers: ["had"], explanation: "Earlier past action → past perfect." },
  { id: "st2", topicId: "storytelling", level: "B2", type: "correct_sentence", prompt: "Correct: \"I was going to the shop and I was seeing an accident.\"", answers: ["i was going to the shop and i saw an accident"], explanation: "The interrupting event uses past simple; the background uses past continuous." },
];

export interface PickOptions {
  topicId?: string;
  level?: CefrLevel;
  count: number;
  /** Deterministic seed for reproducible sessions/tests. */
  seed?: number;
}

/** Deterministic PRNG (mulberry32) so sessions are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function levelWithin(target: CefrLevel, candidate: CefrLevel): boolean {
  return LEVEL_ORDER.indexOf(candidate) <= LEVEL_ORDER.indexOf(target);
}

export function pickDrills(opts: PickOptions): Drill[] {
  const random = rng(opts.seed ?? Date.now() % 2147483647);
  const pool = DRILLS.filter(
    (d) =>
      (!opts.topicId || d.topicId === opts.topicId) &&
      (!opts.level || levelWithin(opts.level, d.level)),
  );
  // Fisher-Yates with seeded rng
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, opts.count);
}

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** Deterministic scoring for drills — no AI involved. */
export interface DrillResult {
  correct: boolean;
  matchedAnswer?: string;
}

export function checkDrillAnswer(drill: Drill, response: string): DrillResult {
  const cleaned = response.toLowerCase().trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  for (const a of drill.answers) {
    if (cleaned === a) return { correct: true, matchedAnswer: a };
  }
  // allow trailing/leading article or punctuation variants for fill_blank
  const compact = cleaned.replace(/^(the|a|an) /, "");
  for (const a of drill.answers) {
    if (compact === a.replace(/^(the|a|an) /, "")) return { correct: true, matchedAnswer: a };
  }
  return { correct: false };
}
