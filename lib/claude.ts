import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-7";

/**
 * Run Claude with a system prompt and user message, parsing the response as JSON.
 * All our prompts return strict JSON (no markdown), so this is the standard call.
 */
export async function claudeJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const msg = await client.messages.create({
    model: opts.model || MODEL,
    max_tokens: opts.maxTokens || 2000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const block = msg.content[0];
  if (block.type !== "text") {
    throw new Error("Claude returned non-text content");
  }

  // Strip optional ```json fences if Claude added them despite instructions
  const cleaned = block.text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("Failed to parse Claude JSON. Raw:", block.text);
    throw new Error("Claude returned invalid JSON");
  }
}
