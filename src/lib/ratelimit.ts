/**
 * Sliding-window rate limits, in memory. Three layers:
 *   - per account (signed in) or per IP (anonymous)
 *   - a server-wide ceiling as a backstop, so spoofed client addresses cannot multiply the quota
 * Enough to stop one visitor from burning the free LLM quota during a demo.
 */
type Bucket = number[]; // timestamps of recent hits

const WINDOW_MS = 10 * 60_000;
const LIMITS = {
  transfer: { anon: 0, user: 10, global: 120 }, // handoff emails go to arbitrary addresses: keep the ceiling low
  llm: { anon: 30, user: 90, global: 400 }, // assistant, explain, explain-batch (per file), ask
  analyze: { anon: 10, user: 30, global: 120 }, // clones and git analysis
} as const;

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export function clientIp(request: Request): string {
  const h = request.headers;
  const direct = h.get("true-client-ip") ?? h.get("cf-connecting-ip");
  if (direct) return direct.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[0];
  }
  return h.get("x-real-ip")?.trim() || "local";
}

export type RateResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number; limit: number; scope: "you" | "server" };

function take(key: string, limit: number, cost: number, now: number): { ok: boolean; retryAfterSec: number; remaining: number } {
  const b = (buckets.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
  if (b.length + cost > limit) {
    buckets.set(key, b);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b[0] + WINDOW_MS - now) / 1000)), remaining: 0 };
  }
  for (let i = 0; i < cost; i++) b.push(now);
  buckets.set(key, b);
  return { ok: true, retryAfterSec: 0, remaining: limit - b.length };
}

/** `who` is the signed-in login when available; anonymous callers are keyed by IP. */
export function rateLimit(request: Request, kind: keyof typeof LIMITS, who: string | null | boolean, cost = 1): RateResult {
  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) {
    for (const [k, b] of buckets) if (b.length === 0 || b[b.length - 1] < now - WINDOW_MS) buckets.delete(k);
    lastSweep = now;
  }
  const signedIn = typeof who === "string" ? who.length > 0 : Boolean(who);
  const limit = LIMITS[kind][signedIn ? "user" : "anon"];
  const key = `${kind}:${typeof who === "string" && who ? `user:${who}` : `ip:${clientIp(request)}`}`;

  // Server-wide ceiling first, so a flood from many spoofed addresses still stops.
  const g = take(`${kind}:global`, LIMITS[kind].global, cost, now);
  if (!g.ok) return { ok: false, retryAfterSec: g.retryAfterSec, limit: LIMITS[kind].global, scope: "server" };
  const r = take(key, limit, cost, now);
  if (!r.ok) return { ok: false, retryAfterSec: r.retryAfterSec, limit, scope: "you" };
  return { ok: true, remaining: r.remaining };
}

export function tooMany(r: Extract<RateResult, { ok: false }>, what: string): Response {
  const mins = Math.ceil(r.retryAfterSec / 60);
  const msg =
    r.scope === "server"
      ? `This server has hit its ceiling of ${r.limit} ${what} in 10 minutes. Try again in about ${mins} minute${mins > 1 ? "s" : ""}.`
      : `Slow down: this ${what === "analyses" ? "address" : "address"} has used its ${r.limit} ${what} for the last 10 minutes. Try again in about ${mins} minute${mins > 1 ? "s" : ""}, or sign in with GitHub for a higher limit.`;
  return Response.json({ error: msg }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
}
