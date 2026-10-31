import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cacheDir } from "./git";
import type { Analysis, RecentAnalysis, Repo } from "./types";

const TTL_MS = 120_000;
const cache = new Map<string, { at: number; repos: Repo[] }>();

export function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect", "X-GitHub-Api-Version": "2022-11-28" };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/** Every repo the user can see: own, collaborator, and org. Cached for two minutes per token. */
export async function listRepos(token: string): Promise<Repo[]> {
  const k = createHash("sha256").update(token).digest("hex").slice(0, 16);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.repos;

  const repos: Repo[] = [];
  for (let page = 1; page <= 4; page++) {
    const res = await fetch(`https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member&page=${page}`, { headers: ghHeaders(token) });
    if (!res.ok) break;
    const batch = (await res.json()) as Repo[];
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  cache.set(k, { at: Date.now(), repos });
  return repos;
}

export function invalidateRepos(token: string) {
  cache.delete(createHash("sha256").update(token).digest("hex").slice(0, 16));
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

export { LANGUAGE_COLORS, relativeTime } from "./format";
