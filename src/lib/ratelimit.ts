/**
 * Per-IP sliding-window rate limit, in memory. Enough to stop one visitor from burning the
 * free LLM quota during a demo. Signed-in users get a higher allowance.
 */
type Bucket = number[]; // timestamps of recent hits

const WINDOW_MS = 10 * 60_000;
const LIMITS = {
  llm: { anon: 30, user: 90 }, // assistant, explain, explain-batch (per file), ask
  analyze: { anon: 10, user: 30 }, // clones and git analysis
} as const;

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function clientIp(request: Request): string {
  const h = request.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "local").trim();
}

export type RateResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number; limit: number };

export function rateLimit(request: Request, kind: keyof typeof LIMITS, signedIn: boolean, cost = 1): RateResult {
  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) {
    for (const [k, b] of buckets) if (b.length === 0 || b[b.length - 1] < now - WINDOW_MS) buckets.delete(k);
    lastSweep = now;
  }
  const limit = LIMITS[kind][signedIn ? "user" : "anon"];
  const key = `${kind}:${clientIp(request)}`;
  const b = (buckets.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
  if (b.length + cost > limit) {
    buckets.set(key, b);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b[0] + WINDOW_MS - now) / 1000)), limit };
  }
  for (let i = 0; i < cost; i++) b.push(now);
  buckets.set(key, b);
  return { ok: true, remaining: limit - b.length };
}

export function tooMany(r: Extract<RateResult, { ok: false }>, what: string): Response {
  const mins = Math.ceil(r.retryAfterSec / 60);
  return Response.json(
    { error: `Slow down: this address has used its ${r.limit} ${what} for the last 10 minutes. Try again in about ${mins} minute${mins > 1 ? "s" : ""}, or sign in with GitHub for a higher limit.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
  );
}
