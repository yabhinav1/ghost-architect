import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { serverGithubToken } from "./env.ts";
import { cacheDir } from "./git.ts";
import type { Analysis, RecentAnalysis, Repo } from "./types.ts";

const TTL_MS = 120_000;
const listingCache = new Map<string, { at: number; listing: RepoListing }>();

export function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect", "X-GitHub-Api-Version": "2022-11-28" };
  const t = token || serverGithubToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export type RepoListing = { repos: Repo[]; installations: number; fetchedAt?: string };

async function pageAll<T>(url: string, token: string, pick: (j: unknown) => T[], maxPages = 4): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}per_page=100&page=${page}`, { headers: ghHeaders(token) });
    if (!res.ok) break;
    const batch = pick(await res.json());
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/**
 * Every repo the user can see. OAuth-app tokens get everything from /user/repos. GitHub-App
 * user tokens only see repos where the app is installed, so those are unioned in from
 * /user/installations. Cached for two minutes per token.
 */
export async function listRepos(token: string): Promise<RepoListing> {
  const k = createHash("sha256").update(token).digest("hex").slice(0, 16);
  const hit = listingCache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.listing;

  const byId = new Map<number, Repo>();
  const direct = await pageAll<Repo>("https://api.github.com/user/repos?sort=pushed&affiliation=owner,collaborator,organization_member", token, (j) => (Array.isArray(j) ? (j as Repo[]) : []));
  for (const r of direct) byId.set(r.id, r);

  let installations = 0;
  const inst = await pageAll<{ id: number }>("https://api.github.com/user/installations", token, (j) => ((j as { installations?: { id: number }[] }).installations ?? []), 1);
  installations = inst.length;
  for (const i of inst) {
    const repos = await pageAll<Repo>(`https://api.github.com/user/installations/${i.id}/repositories`, token, (j) => ((j as { repositories?: Repo[] }).repositories ?? []));
    for (const r of repos) byId.set(r.id, r);
  }

  const repos = [...byId.values()].sort((a, b) => b.pushed_at.localeCompare(a.pushed_at));
  const listing = { repos, installations, fetchedAt: new Date().toISOString() };
  listingCache.set(k, { at: Date.now(), listing });
  return listing;
}

export function invalidateRepos(token: string) {
  listingCache.delete(createHash("sha256").update(token).digest("hex").slice(0, 16));
}

export async function recentAnalyses(limit = 8): Promise<RecentAnalysis[]> {
  const dir = cacheDir("analysis");
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const out: RecentAnalysis[] = [];
  for (const n of names) {
    try {
      const a = JSON.parse(await fs.readFile(path.join(dir, n), "utf8")) as Analysis;
      out.push({ repoUrl: a.repoUrl, slug: a.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, ""), analyzedAt: a.analyzedAt, analysedFiles: a.analysedFiles, authors: Object.keys(a.authors).length });
    } catch {
      // skip unreadable
    }
  }
  return out.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt)).slice(0, limit);
}

export { LANGUAGE_COLORS, relativeTime } from "./format.ts";
