/**
 * Minimal OpenAI-compatible chat client. Works with Groq, Gemini (OpenAI
 * endpoint), OpenRouter, Ollama and anything else that speaks
 * /v1/chat/completions. No SDK, no paid provider required.
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class LlmError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function llmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
  return { baseUrl, apiKey, model };
}

export async function chatJson(messages: ChatMessage[], opts: { maxTokens?: number } = {}): Promise<{ text: string; model: string }> {
  const { baseUrl, apiKey, model } = llmConfig();
  if (!apiKey) throw new LlmError("LLM_API_KEY is not set. Copy .env.example to .env.local and add a free Groq or Gemini key.", 401);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 4000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new LlmError(`LLM request failed (${res.status}): ${detail}`, res.status);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new LlmError("LLM returned an empty response", 502);
  return { text, model };
}

/** Pull the first JSON object out of a response, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new LlmError("LLM response was not valid JSON", 502);
  }
}
