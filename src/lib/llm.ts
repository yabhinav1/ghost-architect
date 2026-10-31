/**
 * Minimal OpenAI-compatible chat client with a lane scheduler. A lane is one provider + model.
 * Free tiers rate-limit per model (Groq: ~8k tokens/min per model), so spreading a batch across
 * two models on the same key doubles throughput, and a second provider (Gemini's OpenAI endpoint,
 * OpenRouter, Ollama) adds more. Single calls always prefer the first lane, so quality is unchanged.
 *
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL      primary provider and preferred model
 *   LLM_MODELS=modelA,modelB                   extra models on the primary provider (optional)
 *   LLM2_BASE_URL, LLM2_API_KEY, LLM2_MODEL   optional second provider
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class LlmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Lane = { id: string; baseUrl: string; apiKey: string; model: string; cooldownUntil: number; inflight: number };

const MAX_ATTEMPTS = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function llmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "openai/gpt-oss-120b";
  return { baseUrl, apiKey, model };
}

let laneCache: Lane[] | null = null;
function lanes(): Lane[] {
  if (laneCache) return laneCache;
  const { baseUrl, apiKey, model } = llmConfig();
  const out: Lane[] = [];
  if (apiKey) {
    const extra = (process.env.LLM_MODELS ?? (baseUrl.includes("groq.com") ? "openai/gpt-oss-20b" : "")).split(",").map((s) => s.trim()).filter(Boolean);
    for (const m of [model, ...extra.filter((m) => m !== model)]) out.push({ id: `p1:${m}`, baseUrl, apiKey, model: m, cooldownUntil: 0, inflight: 0 });
  }
  if (process.env.LLM2_BASE_URL && process.env.LLM2_API_KEY && process.env.LLM2_MODEL) {
    out.push({ id: `p2:${process.env.LLM2_MODEL}`, baseUrl: process.env.LLM2_BASE_URL.replace(/\/+$/, ""), apiKey: process.env.LLM2_API_KEY, model: process.env.LLM2_MODEL, cooldownUntil: 0, inflight: 0 });
  }
  laneCache = out;
  return out;
}

/** How many requests can usefully run at once: one per lane. */
export function laneCount(): number {
  return Math.max(1, lanes().length);
}

export function laneSummary(): { id: string; model: string; coolingFor: number }[] {
  const now = Date.now();
  return lanes().map((l) => ({ id: l.id, model: l.model, coolingFor: Math.max(0, Math.ceil((l.cooldownUntil - now) / 1000)) }));
}

/** First lane that is not cooling down, preferring idle lanes and the primary model; null if all are cooling. */
function pickLane(): Lane | null {
  const now = Date.now();
  const ready = lanes().filter((l) => l.cooldownUntil <= now);
  if (!ready.length) return null;
  ready.sort((a, b) => a.inflight - b.inflight || lanes().indexOf(a) - lanes().indexOf(b));
  return ready[0];
}

function retryDelayMs(status: number, body: string, headers: Headers, attempt: number): number | null {
  if (status !== 429 && status < 500) return null;
  const m = body.match(/try again in\s+([\d.]+)\s*(ms|s|m)/i);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    return Math.ceil(unit === "ms" ? n : unit === "m" ? n * 60_000 : n * 1000) + 500;
  }
  const ra = Number(headers.get("retry-after"));
  if (ra > 0) return ra * 1000 + 500;
  return Math.min(30000, 2000 * 2 ** attempt);
}

async function request(lane: Lane, body: Record<string, unknown>): Promise<Response> {
  lane.inflight++;
  try {
    return await fetch(`${lane.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lane.apiKey}` },
      body: JSON.stringify({ model: lane.model, ...body }),
    });
  } finally {
    lane.inflight--;
  }
}

/** Run one request on the best available lane, rotating lanes on rate limits and server errors. */
async function withLane(body: Record<string, unknown>): Promise<{ res: Response; lane: Lane }> {
  if (!lanes().length) throw new LlmError("LLM_API_KEY is not set. Copy .env.example to .env.local and add a free Groq or Gemini key.", 401);
  let lastErr: LlmError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let lane = pickLane();
    if (!lane) {
      const wait = Math.min(45000, Math.max(500, Math.min(...lanes().map((l) => l.cooldownUntil)) - Date.now()));
      await sleep(wait);
      lane = pickLane() ?? lanes()[0];
    }
    const res = await request(lane, body);
    if (res.ok) return { res, lane };
    const detail = (await res.text()).slice(0, 500);
    lastErr = new LlmError(`LLM request failed (${res.status}) on ${lane.model}: ${detail}`, res.status);
    const wait = retryDelayMs(res.status, detail, res.headers, attempt);
    if (wait === null) throw lastErr; // 4xx other than 429: not retryable
    lane.cooldownUntil = Date.now() + wait; // park this lane; the loop picks another or waits
  }
  throw lastErr!;
}

export async function chatJson(messages: ChatMessage[], opts: { maxTokens?: number } = {}): Promise<{ text: string; model: string }> {
  const { res, lane } = await withLane({ messages, temperature: 0.2, max_tokens: opts.maxTokens ?? 3000, response_format: { type: "json_object" } });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new LlmError("LLM returned an empty response", 502);
  return { text, model: lane.model };
}

/** Streaming chat. Yields text deltas as they arrive (OpenAI-compatible SSE). */
export async function* chatStream(messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number } = {}): AsyncGenerator<string> {
  const { res } = await withLane({ messages, temperature: opts.temperature ?? 0.4, max_tokens: opts.maxTokens ?? 700, stream: true });
  if (!res.body) throw new LlmError("LLM returned no stream", 502);
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
