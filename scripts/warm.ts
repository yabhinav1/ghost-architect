/**
 * Pre-analyse repos so the demo never depends on venue wifi for the clone.
 *   npm run warm                      # the three sample repos
 *   npm run warm -- https://github.com/org/repo
 */
import { analyzeRepo } from "../src/lib/git.ts";

const DEFAULTS = ["https://github.com/expressjs/express", "https://github.com/pallets/flask", "https://github.com/axios/axios"];
const repos = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;

for (const repo of repos) {
  const t0 = Date.now();
  console.log(`\n→ ${repo}`);
  try {
    const a = await analyzeRepo(repo, true, (p) => {
      const pct = p.total ? ` ${p.done}/${p.total}` : "";
      process.stdout.write(`   ${p.step}${pct}\n`);
    });
    console.log(`   ✓ ${a.analysedFiles} files, ${Object.keys(a.authors).length} authors, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`   ✗ ${(e as Error).message}`);
  }
}
