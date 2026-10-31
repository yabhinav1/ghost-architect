import { explainFile } from "./explain.ts";
import { analyzeRepo } from "./git.ts";
import type { Analysis } from "./types.ts";

export const SAMPLE_REPOS = ["https://github.com/expressjs/express", "https://github.com/pallets/flask", "https://github.com/axios/axios"];

/** Files worth pre-briefing: busiest and most imported first (no departed list needed). */
export function briefCandidates(a: Analysis, n: number): string[] {
  return [...a.files].sort((x, y) => y.commits12m * (1 + y.inbound) - x.commits12m * (1 + x.inbound) || y.lines - x.lines).slice(0, n).map((f) => f.path);
}

let warming = false;

/**
 * Called from instrumentation.ts after the server starts, so a fresh deploy on an ephemeral disk
 * warms itself instead of making the first visitor wait. WARM_REPOS overrides the list, WARM_BRIEFS
 * adds N briefs per repo, WARM_ON_BOOT=0 disables.
 */
export async function warmOnBoot(log: (m: string) => void = (m) => console.log(`[warm] ${m}`)): Promise<void> {
  if (warming) return;
  warming = true;
  const repos = (process.env.WARM_REPOS ?? SAMPLE_REPOS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
  const briefs = Math.max(0, Number(process.env.WARM_BRIEFS ?? 0) || 0);
  try {
    for (const repo of repos) {
      const t0 = Date.now();
      try {
        const a = await analyzeRepo(repo);
        log(`${repo}: ${a.analysedFiles} files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        for (const f of briefCandidates(a, briefs)) {
          try {
            await explainFile(repo, f, []);
            log(`  brief ready: ${f}`);
          } catch (e) {
            log(`  brief failed: ${f}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        log(`${repo}: failed: ${(e as Error).message}`);
      }
    }
  } finally {
    warming = false;
  }
}
