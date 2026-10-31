/**
 * Pre-analyse repos so the demo never waits on a clone, optionally pre-writing briefs.
 *   npm run warm                                               # three sample repos, locally
 *   npm run warm -- https://github.com/org/repo                # your own, locally
 *   npm run warm -- --briefs 10                                # also write briefs for the top 10 files of each
 *   npm run warm -- --remote https://ghost-architect.onrender.com --briefs 5   # on the live site
 */
import { SAMPLE_REPOS, briefCandidates } from "../src/lib/warm.ts";
import type { Analysis, Progress } from "../src/lib/types.ts";

export {};

const args = process.argv.slice(2);
function opt(name: string): string | null {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
}
const remote = opt("--remote")?.replace(/\/+$/, "") ?? null;
const briefs = Math.max(0, Number(opt("--briefs") ?? 0) || 0);
const repos = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--remote" && args[i - 1] !== "--briefs");
const list = repos.length ? repos : SAMPLE_REPOS;

async function readNdjson(res: Response, onLine: (msg: Record<string, unknown>) => void) {
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onLine(JSON.parse(line));
  }
}

async function analyseRemote(base: string, repo: string): Promise<Analysis> {
  let result: Analysis | null = null;
  const res = await fetch(`${base}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: repo }) });
  await readNdjson(res, (msg) => {
    const p = msg.progress as Progress | undefined;
    if (p) process.stdout.write(`   ${p.step}${p.total ? ` ${p.done}/${p.total}` : ""}\n`);
    if (msg.error) throw new Error(String(msg.error));
    if (msg.result) result = msg.result as Analysis;
  });
  if (!result) throw new Error("stream ended without a result");
  return result;
}

async function briefsRemote(base: string, repo: string, files: string[]) {
  const res = await fetch(`${base}/api/explain-batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: repo, files, departed: [] }) });
  await readNdjson(res, (msg) => process.stdout.write(`   brief ${msg.error ? "failed" : "ready"}: ${msg.file}${msg.error ? ` (${msg.error})` : ""}\n`));
}

for (const repo of list) {
  const t0 = Date.now();
  console.log(`\n→ ${repo}${remote ? ` (on ${remote})` : ""}`);
  try {
    let a: Analysis;
    if (remote) a = await analyseRemote(remote, repo);
    else {
      const { analyzeRepo } = await import("../src/lib/git.ts");
      a = await analyzeRepo(repo, true, (p: Progress) => process.stdout.write(`   ${p.step}${p.total ? ` ${p.done}/${p.total}` : ""}\n`));
    }
    console.log(`   ✓ ${a.analysedFiles} files, ${Object.keys(a.authors).length} authors, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (briefs > 0) {
      const files = briefCandidates(a, briefs);
      console.log(`   writing ${files.length} briefs…`);
      if (remote) await briefsRemote(remote, repo, files);
      else {
        const { explainFile } = await import("../src/lib/explain.ts");
        for (const f of files) {
          try {
            await explainFile(repo, f, []);
            console.log(`   brief ready: ${f}`);
          } catch (e) {
            console.log(`   brief failed: ${f} (${(e as Error).message})`);
          }
        }
      }
    }
  } catch (e) {
    console.error(`   ✗ ${(e as Error).message}`);
  }
}
