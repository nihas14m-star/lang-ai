import { loadConfig } from "../../backend/src/config.js";
import { fetchJson } from "../../backend/src/ai/provider.js";

const config = loadConfig();
const baseUrl = config.nvidia.baseUrl!.replace(/\/$/, "");

const candidates = [
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "meta/llama-3.2-90b-vision-instruct",
  "qwen/qwen2.5-7b-instruct",
  "deepseek-ai/deepseek-r1",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
];

for (const model of candidates) {
  try {
    const json = await fetchJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.nvidia.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 200,
        stream: false,
      }),
    }, 30000) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.slice(0, 60).replace(/\n/g, " ");
    console.log(`OK   ${model} -> ${text}`);
  } catch (err) {
    console.log(`FAIL ${model} -> ${(err instanceof Error ? err.message : String(err)).slice(0, 90)}`);
  }
}
