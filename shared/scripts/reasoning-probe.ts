import { loadConfig } from "../../backend/src/config.js";

const config = loadConfig();
const baseUrl = config.nvidia.baseUrl!.replace(/\/$/, "");

async function call(label: string, body: Record<string, unknown>): Promise<void> {
  try {
    const json = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.nvidia.apiKey}` },
      body: JSON.stringify(body),
    }).then((r) => r.json()) as any;
    const choice = json.choices?.[0];
    console.log(`--- ${label} ---`);
    console.log("finish_reason:", choice?.finish_reason);
    console.log("content:", JSON.stringify(choice?.message?.content?.slice(0, 200)));
    console.log("reasoning_content present:", choice?.message?.reasoning_content !== undefined);
    console.log("usage:", JSON.stringify(json.usage));
  } catch (err) {
    console.log(`--- ${label} --- FAILED: ${(err as Error).message.slice(0, 100)}`);
  }
}

const base = {
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  messages: [{ role: "user", content: 'Return ONLY this JSON: {"ok": true}' }],
  stream: false,
};

await call("plain max400", { ...base, max_tokens: 400 });
await call("thinking:false max400", { ...base, max_tokens: 400, chat_template_kwargs: { thinking: false } });
await call("thinking:false max800 json_mode", { ...base, max_tokens: 800, chat_template_kwargs: { thinking: false }, response_format: { type: "json_object" } });
