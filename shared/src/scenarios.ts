/**
 * Conversation scenarios: objectives, difficulty, target language.
 * The tutor guides the learner toward the objective without interrupting
 * every sentence.
 */

import type { ScenarioDescriptorT } from "./contracts";
import type { CefrLevel } from "./cefr";

function scenario(
  id: string,
  title: string,
  difficulty: CefrLevel,
  description: string,
  objective: string,
  targetVocabulary: string[],
  targetGrammar: string[],
  successCriteria: string[],
): ScenarioDescriptorT {
  return { id, title, difficulty, description, objective, targetVocabulary, targetGrammar, successCriteria };
}

export const SCENARIOS: ScenarioDescriptorT[] = [
  scenario(
    "introductions",
    "Meeting new people",
    "A1",
    "You meet a new classmate at college. Introduce yourselves.",
    "Introduce yourself: name, where you're from, one interest, and ask two questions back.",
    ["pleased to meet you", "major", "hobby", "originally"],
    ["present simple", "question formation"],
    ["You said your name and where you're from", "You asked at least two questions", "You replied naturally to their answers"],
  ),
  scenario(
    "casual_smalltalk",
    "Casual conversation",
    "A2",
    "A friendly chat with a neighbor about the weekend and daily life.",
    "Hold a relaxed 6+ turn conversation about your weekend.",
    ["weekend", "usually", "pretty good", "how about you"],
    ["past simple", "present simple"],
    ["You described your weekend in 3+ sentences", "You asked about their weekend"],
  ),
  scenario(
    "ordering_food",
    "Ordering food at a restaurant",
    "A1",
    "You're at a restaurant. Order a meal and ask about the menu.",
    "Order politely, ask one question about the menu, and respond to the waiter.",
    ["I'd like", "Could I have", "bill", "recommend"],
    ["would like", "polite requests"],
    ["You ordered politely", "You asked about something on the menu", "You handled the bill"],
  ),
  scenario(
    "travel_airport",
    "Travel: at the airport",
    "A2",
    "Check in for a flight, ask about the gate, and handle a small delay.",
    "Check in, ask about your boarding gate and handle a delay announcement.",
    ["check in", "boarding", "gate", "delayed", "aisle seat"],
    ["present simple", "polite questions"],
    ["You completed check-in questions", "You asked about gate or timing", "You responded to the delay"],
  ),
  scenario(
    "college_daily",
    "College life",
    "A2",
    "Chat with a classmate about classes, assignments and plans.",
    "Discuss your courses and an upcoming assignment; make one plan together.",
    ["assignment", "deadline", "lecture", "let's"],
    ["present simple", "future forms"],
    ["You described your courses", "You mentioned a deadline", "You proposed a plan"],
  ),
  scenario(
    "customer_service",
    "Customer service call",
    "B1",
    "Your internet is not working. Call support and get it fixed.",
    "Explain the problem clearly, give details, and agree on a resolution.",
    ["It stopped working", "since", "I'd appreciate", "resolve"],
    ["present perfect", "polite requests"],
    ["You explained the issue with details", "You answered troubleshooting questions", "You reached a resolution"],
  ),
  scenario(
    "workplace_update",
    "Workplace: project update",
    "B1",
    "Give your manager a short update on a project.",
    "Summarize progress, mention one blocker, and propose next steps.",
    ["progress", "on track", "blocked by", "next steps"],
    ["present perfect", "future forms"],
    ["You summarized progress", "You mentioned a blocker", "You proposed next steps"],
  ),
  scenario(
    "debate_easy",
    "Debate: easy topic",
    "B2",
    "Debate: 'Social media does more good than harm.' Take a side.",
    "State a position, give two reasons with examples, and respond to one counter-argument.",
    ["in my view", "on the other hand", "for instance", "grant that"],
    ["opinion language", "connectors"],
    ["You stated a clear position", "You used at least one example", "You responded to a counter-argument"],
  ),
  scenario(
    "storytelling",
    "Storytelling",
    "B1",
    "Tell the tutor about a memorable journey you took.",
    "Narrate a 1-2 minute story with a beginning, middle and end.",
    ["eventually", "all of a sudden", "looking back", "turned out"],
    ["past simple", "past continuous", "past perfect"],
    ["You narrated events in order", "You used at least two past tenses", "You closed the story"],
  ),
  scenario(
    "presentation_qa",
    "Presentation Q&A",
    "B2",
    "You just presented a project. The tutor is your audience asking questions.",
    "Answer three questions about your project clearly and concisely.",
    ["the key point", "that's a good question", "to put it simply"],
    ["passive voice", "relative clauses"],
    ["You answered 3 questions", "Each answer stayed on topic", "You clarified at least once"],
  ),
  scenario(
    "group_discussion",
    "Group discussion practice",
    "B2",
    "Simulated group discussion: 'Should college education be free?'",
    "Contribute 3 turns: one opinion, one agreement/disagreement with a reason, one invitation to others.",
    ["I'd like to add", "that's fair, but", "what do others think"],
    ["opinion language", "conditionals"],
    ["You gave an opinion with a reason", "You responded to another point of view", "You invited further discussion"],
  ),
  scenario(
    "doctor_visit",
    "At the doctor",
    "A2",
    "Describe your symptoms to a doctor and understand the advice.",
    "Describe symptoms, answer two questions, and repeat the advice in your own words.",
    ["symptoms", "sore throat", "prescription", "twice a day"],
    ["present perfect", "imperatives"],
    ["You described how you feel", "You answered the doctor's questions", "You confirmed the advice"],
  ),
];

export const INTERVIEW_SCENARIOS: ScenarioDescriptorT[] = [
  scenario(
    "interview_hr",
    "HR interview",
    "B1",
    "A formal HR interview for an entry-level role.",
    "Answer HR questions: self-introduction, strengths, why this role.",
    ["I'm currently", "my strengths include", "I'm keen to"],
    ["present perfect", "present simple"],
    ["You introduced yourself in under a minute", "You gave specific examples", "You kept answers relevant"],
  ),
  scenario(
    "interview_technical_intro",
    "Technical introduction",
    "B2",
    "Explain a technical project you built, to an interviewer.",
    "Explain your project: problem, approach, your role, and one result.",
    ["the problem was", "I was responsible for", "as a result"],
    ["past simple", "passive voice"],
    ["You explained the problem clearly", "You described your specific role", "You mentioned a measurable result"],
  ),
  scenario(
    "interview_internship",
    "Internship interview",
    "B1",
    "Interview for an internship at a product company.",
    "Show motivation and fit: why the company, what you'll contribute, what you'll learn.",
    ["I admire", "I could contribute", "I'm eager to learn"],
    ["future forms", "present simple"],
    ["You explained why this company", "You offered a concrete contribution", "You asked one good question"],
  ),
  scenario(
    "interview_college",
    "College admission interview",
    "B1",
    "Admissions interview for a degree program.",
    "Explain your academic interests and goals, and answer follow-ups.",
    ["I'm interested in", "my goal is", "for example"],
    ["present simple", "future forms"],
    ["You explained your interest with an example", "You described a goal", "You answered a follow-up"],
  ),
  scenario(
    "interview_behavioral",
    "Behavioral questions",
    "B2",
    "STAR-format behavioral interview questions.",
    "Answer with the STAR structure: Situation, Task, Action, Result.",
    ["at that time", "I decided to", "in the end", "the result was"],
    ["past simple", "past perfect"],
    ["You used the STAR structure", "You described your own actions", "You finished with a result"],
  ),
];

export function scenarioById(id: string): ScenarioDescriptorT | undefined {
  return [...SCENARIOS, ...INTERVIEW_SCENARIOS].find((s) => s.id === id);
}

/** Difficulty hint passed to the tutor so its language matches the learner. */
export function levelToPromptGuidance(level: CefrLevel): string {
  switch (level) {
    case "A1": return "Use very simple sentences (5-10 words), common words only, one idea per sentence.";
    case "A2": return "Use simple everyday sentences; avoid idioms; keep instructions short.";
    case "B1": return "Use clear everyday language with occasional natural expressions; avoid complex idioms.";
    case "B2": return "Use natural conversational English; idioms are fine with brief context.";
    case "C1": return "Use rich, natural English including idioms and nuance.";
    case "C2": return "Speak as with a near-native peer; full natural range is fine.";
  }
}
