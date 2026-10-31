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

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Free tiers rate-limit by tokens per minute. Groq says how long to wait in the error body. */
function retryDelayMs(status: number, body: string, headers: Headers, attempt: number): number | null {
  if (status !== 429 && status < 500) return null;
  const m = body.match(/try again in\s+([\d.]+)\s*(ms|s)/i);
  if (m) return Math.ceil(Number(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000)) + 500;
  const ra = Number(headers.get("retry-after"));
  if (ra > 0) return ra * 1000 + 500;
  return Math.min(30000, 2000 * 2 ** attempt);
}

export async function chatJson(messages: ChatMessage[], opts: { maxTokens?: number } = {}): Promise<{ text: string; model: string }> {
  const { baseUrl, apiKey, model } = llmConfig();
  if (!apiKey) throw new LlmError("LLM_API_KEY is not set. Copy .env.example to .env.local and add a free Groq or Gemini key.", 401);

  let lastErr: LlmError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: opts.maxTokens ?? 3000,
        response_format: { type: "json_object" },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) throw new LlmError("LLM returned an empty response", 502);
      return { text, model };
    }
    const detail = (await res.text()).slice(0, 500);
    lastErr = new LlmError(`LLM request failed (${res.status}): ${detail}`, res.status);
    const wait = retryDelayMs(res.status, detail, res.headers, attempt);
    if (wait === null || attempt === MAX_ATTEMPTS - 1) break;
    await sleep(Math.min(wait, 45000));
  }
  throw lastErr!;
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

/**
 * Streaming chat. Yields text deltas as they arrive (OpenAI-compatible SSE).
 * Used by the in-app assistant so answers appear as they are written.
 */
export async function* chatStream(messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number } = {}): AsyncGenerator<string> {
  const { baseUrl, apiKey, model } = llmConfig();
  if (!apiKey) throw new LlmError("LLM_API_KEY is not set. Copy .env.example to .env.local and add a free Groq or Gemini key.", 401);
  let res: Response | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.4, max_tokens: opts.maxTokens ?? 700, stream: true }),
    });
    if (res.ok) break;
    const detail = (await res.text()).slice(0, 500);
    const wait = retryDelayMs(res.status, detail, res.headers, attempt);
    if (wait === null || attempt === MAX_ATTEMPTS - 1) throw new LlmError(`LLM request failed (${res.status}): ${detail}`, res.status);
    await sleep(Math.min(wait, 45000));
  }
  if (!res?.body) throw new LlmError("LLM returned no stream", 502);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const piece = j.choices?.[0]?.delta?.content;
        if (piece) yield piece;
      } catch {
        // partial line, ignore
      }
    }
  }
}
