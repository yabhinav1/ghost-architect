import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { storeGet, storeSet } from "./store";
import type { Analysis, FileStat, Progress } from "./types";

const run = promisify(execFile);
const CACHE = path.join(process.cwd(), ".cache");
const MAX_FILES = 250;
/** Parallel git blame processes. Keep this low on small hosts: each blame streams but git itself uses memory. */
const BLAME_CONCURRENCY = Math.max(1, Number(process.env.BLAME_CONCURRENCY ?? (process.env.RENDER ? 3 : 8)));
/** Files bigger than this are not blamed line by line (generated bundles, data dumps); they get one owner from git log. */
const MAX_BLAME_BYTES = 400 * 1024;
const MAX_BUFFER = 256 * 1024 * 1024;
/** Refuse to clone anything bigger than this (GitHub reports size in KB). Protects small hosts. */
export const MAX_REPO_KB = Number(process.env.MAX_REPO_MB ?? 300) * 1024;
/** History window. Keeps the one-pass git log bounded on very large repos. */
const HISTORY_WINDOW = "3.years";
const TIMELINE_CAP = 300;
const MONTH_MS = 30.44 * 24 * 3600 * 1000;

const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  ".py", ".go", ".java", ".kt", ".kts", ".scala", ".rb", ".rs", ".cs", ".php", ".swift", ".m", ".mm", ".dart", ".ex", ".exs", ".lua", ".r", ".R",
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh",
  ".html", ".htm", ".css", ".scss", ".sass", ".less", ".sql", ".sh", ".bash", ".zsh", ".ps1", ".pl", ".ipynb",
]);
const SKIP_DIRS = /(^|\/)(node_modules|vendor|dist|build|out|\.next|coverage|__pycache__|third_party|generated|fixtures|testdata)\//;
const SKIP_FILES = /(\.min\.js|\.d\.ts|\.lock|package-lock\.json|yarn\.lock|\.snap|\.pb\.go|_pb2\.py)$/;

type OnProgress = (p: Progress) => void;

export function normalizeRepoUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Repo URL must start with https://");
  url = url.replace(/\/+$/, "").replace(/\.git$/, "");
  const u = new URL(url);
  u.hostname = u.hostname.toLowerCase();
  u.search = "";
  u.hash = "";
  return u.toString();
}

export function repoKey(repoUrl: string): string {
  return createHash("sha1").update(normalizeRepoUrl(repoUrl)).digest("hex").slice(0, 12);
}

export function cacheDir(...parts: string[]): string {
  return path.join(CACHE, ...parts);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function git(dir: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: dir, maxBuffer: MAX_BUFFER });
  return stdout;
}

/** Auth header for a one-off clone. The token is never written to .git/config. */
function authArgs(token?: string): string[] {
  if (!token) return [];
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`];
}

/** For GitHub repos, check existence and size before cloning. Other hosts are cloned blind. */
async function preflight(url: string, token?: string): Promise<void> {
  if (process.env.GHOST_SKIP_PREFLIGHT === "1") return;
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!m) return;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers });
  } catch {
    return; // network hiccup: let git decide
  }
  if (res.status === 404) throw new Error(token ? "Repository not found, or your account cannot see it." : "Repository not found. If it is private, sign in with GitHub first.");
  if (res.status === 403 || res.status === 429) return; // rate limited: the clone watchdog below still enforces the size limit
  if (!res.ok) return;
  const info = (await res.json()) as { size?: number; full_name?: string };
  if (info.size && info.size > MAX_REPO_KB) {
    throw new Error(`${info.full_name ?? "This repository"} is ${Math.round(info.size / 1024)} MB. The limit on this server is ${Math.round(MAX_REPO_KB / 1024)} MB. Try a smaller repo, or run Ghost-Architect locally for big ones.`);
  }
}

export async function ensureClone(repoUrl: string, onProgress?: OnProgress, token?: string): Promise<string> {
  const url = normalizeRepoUrl(repoUrl);
  const dir = path.join(CACHE, "repos", repoKey(url));
  if (await exists(path.join(dir, ".git"))) {
    onProgress?.({ step: "Using cached clone" });
    return dir;
  }
  onProgress?.({ step: "Checking repository" });
  await preflight(url, token);
  onProgress?.({ step: "Cloning repository" });
  await fs.mkdir(path.dirname(dir), { recursive: true });
  try {
    await cloneWithLimit(url, dir, token, onProgress);
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true });
    if (e instanceof SizeLimitError) throw e;
    const msg = (e as { stderr?: string }).stderr ?? (e as Error).message;
    throw new Error(`git clone failed. ${token ? "Check you have access to this repo." : "Is the repo public? Sign in with GitHub for private repos."} ${msg.split("\n").filter(Boolean).slice(-1)[0] ?? ""}`.trim());
  }
  return dir;
}

class SizeLimitError extends Error {}

async function dirKb(dir: string): Promise<number> {
  try {
    const { stdout } = await run("du", ["-sk", dir]);
    return Number(stdout.split("\t")[0]) || 0;
  } catch {
    return 0;
  }
}

/**
 * git clone with a watchdog: the .git directory is measured every two seconds and the clone is
 * killed if it passes the size limit. Works even when the GitHub API cannot tell us the size.
 */
function cloneWithLimit(url: string, dir: string, token: string | undefined, onProgress?: OnProgress): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", [...authArgs(token), "clone", "--quiet", "--no-tags", url + ".git", dir], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (d) => { stderr += String(d); });
    let killed: string | null = null;
    const started = Date.now();
    const timer = setInterval(async () => {
      const kb = await dirKb(dir);
      const mb = Math.round(kb / 1024);
      if (mb > 0) onProgress?.({ step: `Cloning repository (${mb} MB so far)` });
      if (kb > MAX_REPO_KB) {
        killed = `Stopped cloning at ${mb} MB: the limit on this server is ${Math.round(MAX_REPO_KB / 1024)} MB. Try a smaller repo, or run Ghost-Architect locally for big ones.`;
        child.kill("SIGKILL");
      } else if (Date.now() - started > 10 * 60_000) {
        killed = "Clone took longer than 10 minutes and was stopped.";
        child.kill("SIGKILL");
      }
    }, 2000);
    child.on("error", (e) => { clearInterval(timer); reject(e); });
    child.on("close", (code) => {
      clearInterval(timer);
      if (killed) reject(new SizeLimitError(killed));
      else if (code === 0) resolve();
      else reject(Object.assign(new Error(`git clone exited with ${code}`), { stderr }));
    });
  });
}

function isCodeFile(p: string): boolean {
  if (SKIP_DIRS.test(p) || SKIP_FILES.test(p)) return false;
  return CODE_EXT.has(path.extname(p));
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

/**
 * Line ownership via `git blame --line-porcelain`, consumed as a stream so a large file never
 * sits in memory as one string (line-porcelain output is roughly ten times the file size).
 */
function blame(dir: string, file: string): Promise<{ lines: number; authors: Record<string, number> }> {
  return new Promise((resolve) => {
    const authors: Record<string, number> = {};
    let lines = 0;
    let carry = "";
    const child = spawn("git", ["blame", "-w", "--line-porcelain", "HEAD", "--", file], { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const text = carry + chunk;
      const parts = text.split("\n");
      carry = parts.pop() ?? "";
      for (const line of parts) {
        if (line.startsWith("author-mail ")) {
          const email = line.slice(12).replace(/^<|>$/g, "").toLowerCase();
          authors[email] = (authors[email] ?? 0) + 1;
          lines++;
        }
      }
    });
    child.on("error", () => resolve({ lines: 0, authors: {} }));
    child.on("close", () => resolve({ lines, authors }));
  });
}

/** Cheap ownership for oversized files: whoever made the most commits to it in the window owns all its lines. */
async function coarseOwnership(dir: string, file: string, commitAuthors: Record<string, number> | undefined): Promise<{ lines: number; authors: Record<string, number> }> {
  let lines = 0;
  try {
    const { stdout } = await run("wc", ["-l", path.join(dir, file)]);
    lines = Number(stdout.trim().split(/\s+/)[0]) || 0;
  } catch {
    return { lines: 0, authors: {} };
  }
  const top = Object.entries(commitAuthors ?? {}).sort((a, b) => b[1] - a[1])[0];
  return { lines, authors: top ? { [top[0]]: lines } : {} };
}

/** Build a map of file -> files it imports, restricted to the analysed set. */
async function importGraph(dir: string, files: string[]): Promise<Map<string, Set<string>>> {
  const set = new Set(files);
  const lookup = (candidates: string[]) => candidates.find((c) => set.has(c));
  const jsExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const edges = new Map<string, Set<string>>();

  await pool(files, 16, async (file) => {
    let src = "";
    try {
      src = await fs.readFile(path.join(dir, file), "utf8");
    } catch {
      return;
    }
    const targets = new Set<string>();
    const fromDir = path.posix.dirname(file);
    const ext = path.extname(file);

    if (jsExts.includes(ext)) {
      const re = /(?:from\s+|require\(\s*|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
      for (const m of src.matchAll(re)) {
        const base = path.posix.normalize(path.posix.join(fromDir, m[1]));
        const hit = lookup([base, ...jsExts.map((e) => base + e), ...jsExts.map((e) => base + "/index" + e)]);
        if (hit && hit !== file) targets.add(hit);
      }
    } else if (ext === ".py") {
      const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
      for (const m of src.matchAll(re)) {
        const mod = m[1] ?? m[2];
        let base: string;
        if (mod.startsWith(".")) {
          const ups = mod.match(/^\.+/)![0].length - 1;
          const rest = mod.slice(ups + 1).replace(/\./g, "/");
          let d = fromDir;
          for (let i = 0; i < ups; i++) d = path.posix.dirname(d);
          base = path.posix.normalize(path.posix.join(d, rest));
        } else {
          base = mod.replace(/\./g, "/");
        }
        const hit = lookup([base + ".py", base + "/__init__.py", "src/" + base + ".py", "src/" + base + "/__init__.py"]);
        if (hit && hit !== file) targets.add(hit);
      }
    }
    if (targets.size) edges.set(file, targets);
  });
  return edges;
}

export async function analyzeRepo(repoUrl: string, force = false, onProgress?: OnProgress, token?: string): Promise<Analysis> {
  const url = normalizeRepoUrl(repoUrl);
  const key = repoKey(url);
  const cachePath = path.join(CACHE, "analysis", key + ".json");
  if (!force && (await exists(cachePath))) {
    onProgress?.({ step: "Loaded from cache" });
    return JSON.parse(await fs.readFile(cachePath, "utf8")) as Analysis;
  }
  if (!force) {
    // Durable copy survives redeploys on hosts with an ephemeral disk.
    const remote = await storeGet<Analysis>(`analysis:${key}`);
    if (remote) {
      onProgress?.({ step: "Loaded from durable cache" });
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(remote));
      return remote;
    }
  }

  const dir = await ensureClone(url, onProgress, token);
  onProgress?.({ step: "Listing files" });
  const all = (await git(dir, ["ls-files"])).split("\n").filter(Boolean);
  const code = all.filter(isCodeFile);

  // One bounded pass over history: per-file commit counts, per-author commit counts, last-touched.
  onProgress?.({ step: `Reading ${HISTORY_WINDOW.replace(".", " ")} of history` });
  const now = Date.now();
  const cut12 = now - 12 * MONTH_MS;
  const cut24 = now - 24 * MONTH_MS;
  const commits12m = new Map<string, number>();
  const commits24m = new Map<string, number>();
  const commitAuthors = new Map<string, Record<string, number>>();
  const lastTouched = new Map<string, { date: string; email: string }>();
  const timelines = new Map<string, { d: string; a: string }[]>();
  const names = new Map<string, string>();
  const authorCommits = new Map<string, number>();

  let history: string;
  try {
    const { stdout } = await run("git", ["log", `--since=${HISTORY_WINDOW}`, "--name-only", "--format=%x01%aI%x1f%ae%x1f%an"], { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
    history = stdout;
  } catch (e) {
    if (String((e as Error).message).includes("maxBuffer")) throw new Error("This repository's recent history is too large to analyse on this server. Run Ghost-Architect locally for it.");
    throw e;
  }
  let cur: { date: string; email: string; ts: number } | null = null;
  for (const line of history.split("\n")) {
    if (line.startsWith("\u0001")) {
      const [date, email, name] = line.slice(1).split("\u001f");
      cur = { date, email: email.toLowerCase(), ts: Date.parse(date) };
      if (!names.has(cur.email)) names.set(cur.email, name);
    } else if (line && cur) {
      if (!lastTouched.has(line)) lastTouched.set(line, cur);
      let tl = timelines.get(line);
      if (!tl) timelines.set(line, (tl = []));
      if (tl.length < TIMELINE_CAP) tl.push({ d: cur.date.slice(0, 10), a: cur.email });
      if (cur.ts >= cut12) commits12m.set(line, (commits12m.get(line) ?? 0) + 1);
      if (cur.ts >= cut24) {
        commits24m.set(line, (commits24m.get(line) ?? 0) + 1);
        let rec = commitAuthors.get(line);
        if (!rec) commitAuthors.set(line, (rec = {}));
        rec[cur.email] = (rec[cur.email] ?? 0) + 1;
      }
    }
  }

  const selected = [...code]
    .sort((a, b) => (commits12m.get(b) ?? 0) - (commits12m.get(a) ?? 0) || (commits24m.get(b) ?? 0) - (commits24m.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, MAX_FILES);

  onProgress?.({ step: "Running git blame", done: 0, total: selected.length });
  let doneCount = 0;
  const blames = await pool(selected, BLAME_CONCURRENCY, async (f) => {
    let size = 0;
    try {
      size = (await fs.stat(path.join(dir, f))).size;
    } catch {
      // deleted in working tree; blame will return nothing
    }
    const b = size > MAX_BLAME_BYTES ? await coarseOwnership(dir, f, commitAuthors.get(f)) : await blame(dir, f);
    doneCount++;
    if (doneCount % 10 === 0 || doneCount === selected.length) onProgress?.({ step: "Running git blame", done: doneCount, total: selected.length });
    return b;
  });

  onProgress?.({ step: "Building import graph" });
  const edges = await importGraph(dir, selected);
  const inbound = new Map<string, number>();
  for (const targets of edges.values()) for (const t of targets) inbound.set(t, (inbound.get(t) ?? 0) + 1);

  const files: FileStat[] = [];
  const authors: Analysis["authors"] = {};
  selected.forEach((p, i) => {
    const b = blames[i];
    if (b.lines === 0) return;
    const lt = lastTouched.get(p);
    const ca = commitAuthors.get(p) ?? {};
    files.push({
      path: p,
      lines: b.lines,
      authors: b.authors,
      commitAuthors: ca,
      commits12m: commits12m.get(p) ?? 0,
      commits24m: commits24m.get(p) ?? 0,
      inbound: inbound.get(p) ?? 0,
      lastTouched: lt?.date ?? "",
      lastAuthor: lt?.email ?? "",
      timeline: timelines.get(p) ?? [],
    });
    for (const [email, n] of Object.entries(b.authors)) {
      const a = (authors[email] ??= { name: names.get(email) ?? email, lines: 0, commits: 0 });
      a.lines += n;
    }
    for (const [email, n] of Object.entries(ca)) {
      const a = (authors[email] ??= { name: names.get(email) ?? email, lines: 0, commits: 0 });
      a.commits += n;
      authorCommits.set(email, (authorCommits.get(email) ?? 0) + n);
    }
  });

  const analysis: Analysis = {
    repoUrl: url,
    analyzedAt: new Date().toISOString(),
    totalFiles: code.length,
    analysedFiles: files.length,
    files,
    authors,
  };
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(analysis));
  await storeSet(`analysis:${key}`, analysis);
  onProgress?.({ step: "Done" });
  return analysis;
}

/** Recent commits for one file, used as evidence for the explainer. */
export async function fileHistory(repoUrl: string, file: string, limit = 25) {
  const dir = await ensureClone(repoUrl);
  const out = await git(dir, ["log", `-n${limit}`, "--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e", "--", file]);
  return out
    .split("\u001e")
    .map((rec) => rec.trim())
    .filter(Boolean)
    .map((rec) => {
      const [sha, name, email, date, subject, body] = rec.split("\u001f");
      return { sha, name, email: email?.toLowerCase() ?? "", date, subject, body: (body ?? "").trim() };
    });
}

export async function fileContent(repoUrl: string, file: string, maxLines = 600): Promise<{ text: string; truncated: boolean; totalLines: number }> {
  const dir = await ensureClone(repoUrl);
  const text = await fs.readFile(path.join(dir, file), "utf8");
  const lines = text.split("\n");
  return { text: lines.slice(0, maxLines).join("\n"), truncated: lines.length > maxLines, totalLines: lines.length };
}
