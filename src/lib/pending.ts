import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { ensureClone, normalizeRepoUrl } from "./git.ts";
import { ghHeaders } from "./github.ts";

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

import type { PendingBranch, PendingItem, PendingTodo, PendingWork } from "./readiness.ts";
export type { PendingBranch, PendingItem, PendingTodo, PendingWork };

/** Branches whose latest commit is by this email and which hold commits not on the default branch. */
async function orphanedBranches(dir: string, email: string): Promise<PendingBranch[]> {
  let base = "origin/HEAD";
  try {
    base = (await run("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: dir })).stdout.trim() || base;
  } catch {
    // fall back to origin/HEAD
  }
  const { stdout } = await run("git", ["for-each-ref", "--format=%(refname:short)%09%(authoremail)%09%(committerdate:iso-strict)", "refs/remotes/origin"], { cwd: dir, maxBuffer: MAX_BUFFER });
  const out: PendingBranch[] = [];
  for (const line of stdout.split("\n")) {
    const [name, mail, date] = line.split("\t");
    if (!name || name === "origin/HEAD" || name === base) continue;
    if ((mail ?? "").replace(/^<|>$/g, "").toLowerCase() !== email) continue;
    try {
      const n = Number((await run("git", ["rev-list", "--count", `${base}..${name}`], { cwd: dir })).stdout.trim());
      if (n > 0) out.push({ name: name.replace(/^origin\//, ""), unmerged: n, lastCommit: date });
    } catch {
      // unknown base; skip
    }
    if (out.length >= 30) break;
  }
  return out.sort((a, b) => b.lastCommit.localeCompare(a.lastCommit));
}

/** Blame a file once and return line -> {email, date}. */
function blameLines(dir: string, file: string): Promise<Map<number, { email: string; date: string }>> {
  return new Promise((resolve) => {
    const map = new Map<number, { email: string; date: string }>();
    const child = spawn("git", ["blame", "-w", "--line-porcelain", "HEAD", "--", file], { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
    let carry = "";
    let cur = 0;
    let email = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const parts = (carry + chunk).split("\n");
      carry = parts.pop() ?? "";
      for (const l of parts) {
        const h = l.match(/^[0-9a-f]{40} \d+ (\d+)/);
        if (h) cur = Number(h[1]);
        else if (l.startsWith("author-mail ")) email = l.slice(12).replace(/^<|>$/g, "").toLowerCase();
        else if (l.startsWith("author-time ")) map.set(cur, { email, date: new Date(Number(l.slice(12)) * 1000).toISOString().slice(0, 10) });
      }
    });
    child.on("error", () => resolve(map));
    child.on("close", () => resolve(map));
  });
}

/** TODO / FIXME / HACK lines this person wrote: promises in the code that leave with them. */
async function todosBy(dir: string, email: string): Promise<PendingTodo[]> {
  let grep = "";
  try {
    grep = (await run("git", ["grep", "-n", "-I", "-E", "\\b(TODO|FIXME|HACK|XXX)\\b", "HEAD", "--", ".", ":!*.min.js", ":!*.lock", ":!node_modules", ":!vendor", ":!dist"], { cwd: dir, maxBuffer: MAX_BUFFER })).stdout;
  } catch {
    return []; // no matches
  }
  const byFile = new Map<string, { line: number; text: string }[]>();
  for (const l of grep.split("\n").slice(0, 600)) {
    const m = l.match(/^HEAD:([^:]+):(\d+):(.*)$/);
    if (!m) continue;
    const list = byFile.get(m[1]) ?? [];
    list.push({ line: Number(m[2]), text: m[3].trim().slice(0, 160) });
    byFile.set(m[1], list);
  }
  const out: PendingTodo[] = [];
  for (const [file, lines] of [...byFile.entries()].slice(0, 40)) {
    const blame = await blameLines(dir, file);
    for (const { line, text } of lines) {
      const b = blame.get(line);
      if (b && b.email === email) out.push({ file, line, text, date: b.date });
    }
    if (out.length >= 100) break;
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

async function searchIssues(owner: string, repo: string, q: string, token?: string): Promise<PendingItem[]> {
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} ${q}`)}&per_page=30&sort=updated`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub search ${res.status}`);
  const j = (await res.json()) as { items?: { number: number; title: string; html_url: string; updated_at: string; pull_request?: unknown }[] };
  return (j.items ?? []).map((i) => ({ number: i.number, title: i.title, url: i.html_url, updatedAt: i.updated_at, kind: i.pull_request ? "pr" : "issue" }));
}

const cache = new Map<string, { at: number; value: PendingWork }>();

export async function pendingWork(repoUrl: string, login: string, email: string | undefined, token?: string): Promise<PendingWork> {
  const url = normalizeRepoUrl(repoUrl);
  const key = `${url}|${login}|${email ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const notes: string[] = [];
  const dir = await ensureClone(url, undefined, token);
  const gh = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  let pullRequests: PendingItem[] = [];
  let issues: PendingItem[] = [];
  if (gh) {
    try {
      [pullRequests, issues] = await Promise.all([searchIssues(gh[1], gh[2], `is:pr is:open author:${login}`, token), searchIssues(gh[1], gh[2], `is:issue is:open assignee:${login}`, token)]);
    } catch (e) {
      notes.push(`GitHub pull requests and issues could not be fetched (${(e as Error).message}).`);
    }
  } else notes.push("Pull requests and issues are only available for GitHub repositories.");
  let branches: PendingBranch[] = [];
  let todos: PendingTodo[] = [];
  if (email) {
    [branches, todos] = await Promise.all([orphanedBranches(dir, email.toLowerCase()).catch(() => []), todosBy(dir, email.toLowerCase()).catch(() => [])]);
  } else notes.push("No git email on this member: branches and TODOs cannot be attributed. Set it on the organisation overview.");
  const value: PendingWork = { repoUrl: url, login, email, pullRequests, issues, branches, todos, computedAt: new Date().toISOString(), notes };
  cache.set(key, { at: Date.now(), value });
  return value;
}

export { readiness } from "./readiness.ts";
