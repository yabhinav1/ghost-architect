import fs from "node:fs/promises";
import { cacheDir, normalizeRepoUrl, repoKey } from "./git.ts";
import { ghHeaders } from "./github.ts";
import { getSession, type Session } from "./session.ts";
import type { Analysis } from "./types.ts";

import { decideAccess, probeWithGit, type Visibility } from "./access-rules.ts";
export { decideAccess, probeWithGit, type Visibility };

export type AccessDecision = { ok: true; session: Session | null; visibility: Visibility } | { ok: false; status: number; message: string };

const TTL_MS = 10 * 60_000;
const visCache = new Map<string, { at: number; vis: Visibility }>();

async function lookup(owner: string, repo: string, token?: string): Promise<Visibility> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders(token) });
    if (res.status === 404) return "missing";
    if (res.status === 403 || res.status === 429) return "unknown";
    if (!res.ok) return "unknown";
    const j = (await res.json()) as { private?: boolean };
    return j.private ? "private" : "public";
  } catch {
    return "unknown";
  }
}

async function cachedPrivateFlag(url: string): Promise<boolean | undefined> {
  try {
    const a = JSON.parse(await fs.readFile(cacheDir("analysis", repoKey(url) + ".json"), "utf8")) as Analysis;
    return a.private;
  } catch {
    return undefined;
  }
}

/** Who may see this repository's analysis. Non-GitHub URLs are treated as public. */
export async function authorizeRepo(repoUrl: string): Promise<AccessDecision> {
  let url: string;
  try {
    url = normalizeRepoUrl(repoUrl);
  } catch (e) {
    return { ok: false, status: 400, message: (e as Error).message };
  }
  const session = await getSession();
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!m) return { ok: true, session, visibility: "public" };

  // With a session the user's own token answers "can I see it?" directly; without one the server token answers "is it public?".
  const key = `${session?.login ?? "-"}:${url}`;
  const hit = visCache.get(key);
  let vis: Visibility;
  if (hit && Date.now() - hit.at < TTL_MS) vis = hit.vis;
  else {
    vis = await lookup(m[1], m[2], session?.token);
    if (vis !== "unknown") visCache.set(key, { at: Date.now(), vis });
  }
  let cachedPrivate = vis === "unknown" ? await cachedPrivateFlag(url) : undefined;
  if (vis === "unknown" && cachedPrivate === undefined) {
    // Rate-limited and nothing cached: ask git instead of the API.
    const probed = await probeWithGit(url);
    if (probed === "public") {
      vis = "public";
      visCache.set(key, { at: Date.now(), vis });
    } else if (!session) {
      vis = "missing"; // anonymous and not readable anonymously: private or gone
      cachedPrivate = undefined;
    }
  }
  const d = decideAccess(vis, Boolean(session), cachedPrivate);
  if (!d.ok) return { ok: false, status: d.status!, message: d.message! };
  return { ok: true, session, visibility: vis };
}

export function denied(d: Extract<AccessDecision, { ok: false }>): Response {
  return Response.json({ error: d.message }, { status: d.status });
}
