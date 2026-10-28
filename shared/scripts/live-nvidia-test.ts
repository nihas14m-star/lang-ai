import { loadConfig } from "../../backend/src/config.js";
import { NVIDIAProvider } from "../../backend/src/ai/nvidia.js";
import { structuredCall } from "../../backend/src/ai/structured.js";
import { TutorTurnResponseSchema } from "../../shared/src/contracts.js";
import { tutorSystemPrompt, tutorUserPrompt } from "../../backend/src/tutor/prompts.js";
import { LearnerSnapshotSchema } from "../../shared/src/contracts.js";

const config = loadConfig();
const provider = new NVIDIAProvider(config.nvidia);
console.log("Provider:", provider.name, "model:", provider.model, "configured:", provider.isConfigured());

const learner = LearnerSnapshotSchema.parse({
  name: "Asha", nativeLanguage: "Tamil", cefrLevel: "A2",
  activeMistakes: [{ category: "tense", original: "Yesterday I go", corrected: "Yesterday I went", frequency: 3, stage: "guided" }],
});

const messages = [
  { role: "system" as const, content: tutorSystemPrompt(learner) },
  { role: "user" as const, content: tutorUserPrompt([], "Yesterday I go to college and meet my friend") },
];

const result = await structuredCall(provider, TutorTurnResponseSchema, messages, { maxTokens: 800, timeoutMs: 60000 });
console.log("attempts:", result.attempts, "latency:", result.latencyMs + "ms");
if (result.data) {
  console.log("REPLY:", result.data.reply);
  console.log("TTS:", result.data.ttsText);
  console.log("CORRECTIONS:", JSON.stringify(result.data.corrections, null, 1).slice(0, 400));
  console.log("VOCAB:", result.data.vocabulary.map((v) => v.word).join(", "));
} else {
  console.log("STRUCTURED CALL FAILED");
}
