import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { cacheDir, fileContent, fileHistory, normalizeRepoUrl, repoKey } from "./git";
import { chatJson, extractJson } from "./llm";
import type { Brief, BriefResult, Evidence } from "./types";

// Free-tier models sometimes drift from the exact enum ("undocumented", "Documented", "cited").
// Anything that is not clearly documented is treated as inferred, and a claim with no evidence can never be documented.
const Status = z.preprocess((v) => (typeof v === "string" && /^doc/i.test(v.trim()) ? "documented" : "inferred"), z.enum(["documented", "inferred"]));
const Strings = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []), z.array(z.string()));

const BriefSchema = z.object({
  purpose: z.string().default(""),
  claims: z
    .preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.object({ claim: z.string(), evidence: Strings, status: Status })))
    .transform((claims) => claims.map((c) => (c.evidence.length === 0 && c.status === "documented" ? { ...c, status: "inferred" as const } : c))),
  undocumented: Strings,
  risks: Strings,
  safeChangeChecklist: Strings,
});

const SYSTEM = `You are Ghost-Architect, a codebase archaeologist. You explain why a file exists to engineers who inherited it after the original authors left.

Rules:
- Every claim about WHY something was done must cite evidence IDs (C1, P2, ...) from the evidence list and be marked "documented".
- If you can only infer a reason from the code itself, mark the claim "inferred" and say what it is inferred from. Inferred claims have an empty evidence list.
- If no evidence explains a decision, list it under "undocumented". Never invent a plausible story.
- Prefer fewer, well-supported claims over many weak ones.
- Write for a junior engineer: plain words, no fluff.

Respond with ONLY a JSON object of this exact shape:
{
  "purpose": "two or three sentences on what this file does and why it exists",
  "claims": [{ "claim": "...", "evidence": ["C1", "P2"], "status": "documented" | "inferred" }],
  "undocumented": ["a decision in the code that nothing explains"],
  "risks": ["what a newcomer could break, and what depends on this file"],
  "safeChangeChecklist": ["concrete step before changing this file"]
}`;

function parsePrNumbers(messages: string[]): number[] {
  const nums = new Set<number>();
  for (const m of messages) for (const match of m.matchAll(/\(#(\d+)\)|(?:^|\s)#(\d+)\b|pull\/(\d+)/g)) {
    const n = Number(match[1] ?? match[2] ?? match[3]);
    if (n) nums.add(n);
  }
  return [...nums].slice(0, 5);
}

async function fetchGithubPr(owner: string, repo: string, n: number): Promise<Evidence | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${n}`, { headers });
    if (!res.ok) return null;
    const pr = (await res.json()) as { title: string; body: string | null; user?: { login: string }; merged_at: string | null; created_at: string; html_url: string };
    return {
      id: "",
      kind: "pr",
      title: `#${n} ${pr.title}`,
      author: pr.user?.login ?? "",
      date: pr.merged_at ?? pr.created_at,
      url: pr.html_url,
      body: (pr.body ?? "").slice(0, 1000),
    };
  } catch {
    return null;
  }
}

export async function gatherEvidence(repoUrl: string, file: string): Promise<Evidence[]> {
  const url = normalizeRepoUrl(repoUrl);
  const commits = await fileHistory(url, file, 20);
  const evidence: Evidence[] = commits.map((c, i) => ({
    id: `C${i + 1}`,
    kind: "commit",
    title: c.subject,
    author: `${c.name} <${c.email}>`,
    date: c.date,
    url: `${url}/commit/${c.sha}`,
    body: c.body.slice(0, 500),
  }));

  const gh = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (gh) {
    const prs = parsePrNumbers(commits.map((c) => `${c.subject}\n${c.body}`));
    const fetched = await Promise.all(prs.map((n) => fetchGithubPr(gh[1], gh[2], n)));
    fetched.filter((p): p is Evidence => p !== null).forEach((p, i) => evidence.push({ ...p, id: `P${i + 1}` }));
  }
  return evidence;
}

export async function explainFile(repoUrl: string, file: string, departed: string[]): Promise<BriefResult> {
  const [evidence, content] = await Promise.all([gatherEvidence(repoUrl, file), fileContent(repoUrl, file, 260)]);
  const departedSet = new Set(departed.map((d) => d.toLowerCase()));

  const evidenceText = evidence
    .map((e) => {
      const gone = e.kind === "commit" && [...departedSet].some((d) => d && e.author.toLowerCase().includes(d));
      return `[${e.id}] ${e.kind.toUpperCase()} ${e.date.slice(0, 10)} by ${e.author}${gone ? " (DEPARTED)" : ""}\n${e.title}\n${e.body}`.trim();
    })
    .join("\n\n");

  const user = `Repository: ${repoUrl}
File: ${file}${content.truncated ? ` (showing first 260 of ${content.totalLines} lines)` : ""}
Departed authors: ${departed.length ? departed.join(", ") : "none listed"}

=== EVIDENCE (commits and pull requests touching this file, newest first) ===
${evidenceText || "(no history found)"}

=== FILE CONTENT ===
${content.text}`;

  const { text, model } = await chatJson([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
  const parsed = BriefSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error(`LLM returned JSON in the wrong shape: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  const result: BriefResult = { brief: parsed.data as Brief, evidence, model, file, generatedAt: new Date().toISOString() };
  await saveBrief(repoUrl, result);
  return result;
}

function briefPath(repoUrl: string, file: string): string {
  return cacheDir("briefs", repoKey(repoUrl), createHash("sha1").update(file).digest("hex").slice(0, 16) + ".json");
}

async function saveBrief(repoUrl: string, result: BriefResult): Promise<void> {
  const p = briefPath(repoUrl, result.file);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(result));
}

/** Briefs already generated for these files, for the report page. Missing ones are skipped. */
export async function loadBriefs(repoUrl: string, files: string[]): Promise<BriefResult[]> {
  const out: BriefResult[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await fs.readFile(briefPath(repoUrl, f), "utf8")) as BriefResult);
    } catch {
      // not generated yet
    }
  }
  return out;
}
