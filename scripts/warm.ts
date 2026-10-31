/**
 * Pre-analyse repos so the demo never waits on a clone.
 *   npm run warm                                   # three sample repos, locally
 *   npm run warm -- https://github.com/org/repo    # your own, locally
 *   npm run warm -- --remote https://ghost-architect.onrender.com   # warm the live site instead
 */
import type { Progress } from "../src/lib/types.ts";

// Keep this file an ES module after type-stripping so top-level await works.
export {};

const DEFAULTS = ["https://github.com/expressjs/express", "https://github.com/pallets/flask", "https://github.com/axios/axios"];
const args = process.argv.slice(2);
const remoteIdx = args.indexOf("--remote");
const remote = remoteIdx >= 0 ? args[remoteIdx + 1]?.replace(/\/+$/, "") : null;
const repos = args.filter((a, i) => a !== "--remote" && i !== remoteIdx + 1);
const list = repos.length ? repos : DEFAULTS;

async function warmRemote(base: string, repo: string) {
  const res = await fetch(`${base}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: repo }) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.progress) process.stdout.write(`   ${msg.progress.step}${msg.progress.total ? ` ${msg.progress.done}/${msg.progress.total}` : ""}\n`);
      if (msg.error) throw new Error(msg.error);
      if (msg.result) return msg.result as { analysedFiles: number; authors: Record<string, unknown> };
    }
  }
  throw new Error("stream ended without a result");
}

for (const repo of list) {
  const t0 = Date.now();
  console.log(`\n→ ${repo}${remote ? ` (on ${remote})` : ""}`);
  try {
    const a = remote
      ? await warmRemote(remote, repo)
      : await (await import("../src/lib/git.ts")).analyzeRepo(repo, true, (p: Progress) => process.stdout.write(`   ${p.step}${p.total ? ` ${p.done}/${p.total}` : ""}\n`));
    console.log(`   ✓ ${a.analysedFiles} files, ${Object.keys(a.authors).length} authors, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`   ✗ ${(e as Error).message}`);
  }
}
