import fs from "node:fs/promises";
import path from "node:path";
import { cacheDir, normalizeRepoUrl, repoKey } from "./git.ts";
import { storeGet, storeSet } from "./store.ts";
import type { Analysis, RecentAnalysis, RecentEntry, RepoState } from "./types.ts";

/**
 * Per-account data: saved scenarios per repo (who left, who is leaving, KT ticks) and a private
 * history of analysed repos. Files under .cache/users/<login>/, mirrored to Upstash when configured.
 */
function safe(login: string): string {
  return login.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function userDir(login: string): string {
  return cacheDir("users", safe(login));
}

async function readJson<T>(file: string, remoteKey: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    const remote = await storeGet<T>(remoteKey);
    if (remote) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(remote));
    }
    return remote;
  }
}

async function writeJson(file: string, remoteKey: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
  await storeSet(remoteKey, value);
}

export const emptyState = (): RepoState => ({ mode: "notice", departed: [], stillHere: [], noticeEmail: "", lastDay: "", kt: [], updatedAt: new Date(0).toISOString() });

export async function getRepoState(login: string, repoUrl: string): Promise<RepoState | null> {
  const k = repoKey(normalizeRepoUrl(repoUrl));
  return readJson<RepoState>(path.join(userDir(login), `state-${k}.json`), `user:${safe(login)}:state:${k}`);
}

export async function setRepoState(login: string, repoUrl: string, state: Partial<RepoState>): Promise<RepoState> {
  const k = repoKey(normalizeRepoUrl(repoUrl));
  const clean: RepoState = {
    mode: state.mode === "layoffs" ? "layoffs" : "notice",
    departed: (state.departed ?? []).map(String).slice(0, 500),
    stillHere: (state.stillHere ?? []).map(String).slice(0, 500),
    noticeEmail: String(state.noticeEmail ?? "").slice(0, 200),
    lastDay: String(state.lastDay ?? "").slice(0, 20),
    kt: (state.kt ?? []).map(String).slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(path.join(userDir(login), `state-${k}.json`), `user:${safe(login)}:state:${k}`, clean);
  return clean;
}

export async function getRecent(login: string): Promise<RecentEntry[]> {
  return (await readJson<RecentEntry[]>(path.join(userDir(login), "recent.json"), `user:${safe(login)}:recent`)) ?? [];
}

export async function addRecent(login: string, repoUrl: string): Promise<void> {
  const url = normalizeRepoUrl(repoUrl);
  const list = (await getRecent(login)).filter((r) => r.repoUrl !== url);
  list.unshift({ repoUrl: url, at: new Date().toISOString() });
  await writeJson(path.join(userDir(login), "recent.json"), `user:${safe(login)}:recent`, list.slice(0, 30));
}

export async function countSavedScenarios(login: string): Promise<number> {
  try {
    return (await fs.readdir(userDir(login))).filter((n) => n.startsWith("state-")).length;
  } catch {
    return 0;
  }
}

/** Forget everything about this account on this server. Shared analysis caches are untouched. */
export async function clearUser(login: string): Promise<void> {
  await fs.rm(userDir(login), { recursive: true, force: true });
  await storeSet(`user:${safe(login)}:recent`, []);
}

/** The user's history, enriched with file and author counts when the analysis is still cached. */
export async function recentForUser(login: string, limit = 8): Promise<RecentAnalysis[]> {
  const list = await getRecent(login);
  const out: RecentAnalysis[] = [];
  for (const r of list.slice(0, limit)) {
    let analysedFiles = 0;
    let authors = 0;
    try {
      const a = JSON.parse(await fs.readFile(cacheDir("analysis", repoKey(r.repoUrl) + ".json"), "utf8")) as Analysis;
      analysedFiles = a.analysedFiles;
      authors = Object.keys(a.authors).length;
    } catch {
      // analysis evicted; the history entry still links to a fresh run
    }
    out.push({ repoUrl: r.repoUrl, slug: r.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, ""), analyzedAt: r.at, analysedFiles, authors });
  }
  return out;
}
