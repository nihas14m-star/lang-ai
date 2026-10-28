import { loadConfig } from "../../backend/src/config.js";
import { NVIDIAProvider } from "../../backend/src/ai/nvidia.js";
import { extractJson } from "../../backend/src/ai/structured.js";
import { tutorSystemPrompt, tutorUserPrompt } from "../../backend/src/tutor/prompts.js";
import { LearnerSnapshotSchema, TutorTurnResponseSchema } from "../../shared/src/contracts.js";

const config = loadConfig();
const provider = new NVIDIAProvider(config.nvidia);
const learner = LearnerSnapshotSchema.parse({
  name: "Asha", nativeLanguage: "Tamil", cefrLevel: "A2",
  activeMistakes: [{ category: "tense", original: "Yesterday I go", corrected: "Yesterday I went", frequency: 3, stage: "guided" }],
});
const messages = [
  { role: "system" as const, content: tutorSystemPrompt(learner) },
  { role: "user" as const, content: tutorUserPrompt([], "Yesterday I go to college and meet my friend") },
];
const result = await provider.chat({ messages, jsonMode: true, maxTokens: 800, timeoutMs: 60000 });
console.log("=== RAW (first 1500) ===");
console.log(result.text.slice(0, 1500));
const json = extractJson(result.text);
console.log("=== extractJson type:", json === null ? "NULL" : typeof json);
if (json) {
  const parsed = TutorTurnResponseSchema.safeParse(json);
  console.log("schema valid:", parsed.success);
  if (!parsed.success) console.log("issues:", JSON.stringify(parsed.error.issues.slice(0, 6), null, 1));
}
