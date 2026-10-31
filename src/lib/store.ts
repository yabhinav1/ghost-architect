import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Optional durable cache for analyses and briefs, so a redeploy on an ephemeral host does not
 * wipe them. Backed by Upstash Redis over REST (free tier). Without the env vars every call
 * is a no-op and the local .cache directory is the only store.
 *
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=...
 */
const URL_ = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SEC = 14 * 24 * 3600;
const MAX_BYTES = 900 * 1024; // Upstash free tier caps a request at 1 MB

export const storeEnabled = Boolean(URL_ && TOKEN);

async function cmd(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${URL_}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const j = (await res.json()) as { result?: unknown; error?: string };
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function storeGet<T>(key: string, options: { strict?: boolean } = {}): Promise<T | null> {
  if (!storeEnabled) return null;
  try {
    const packed = (await cmd(["GET", key])) as string | null;
    if (!packed) return null;
    return JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString("utf8")) as T;
  } catch (error) {
    if (options.strict) throw error;
    return null;
  }
}

export async function storeSet(key: string, value: unknown, options: { persistent?: boolean } = {}): Promise<void> {
  if (!storeEnabled) return;
  try {
    const packed = gzipSync(Buffer.from(JSON.stringify(value), "utf8")).toString("base64");
    if (packed.length > MAX_BYTES) throw new Error("Record exceeds the durable store size limit");
    // Business records and indexes must survive inactivity. Only derived caches expire.
    await cmd(options.persistent ? ["SET", key, packed] : ["SET", key, packed, "EX", TTL_SEC]);
  } catch (error) {
    if (options.persistent) throw error;
    // Derived caches are best effort; durable writes must report failures to the caller.
  }
}
