import type { FileStat, Scored } from "./types.ts";

export const BLAME_WEIGHT = 0.6;
export const COMMIT_WEIGHT = 0.4;

/**
 * Orphaned Criticality Score.
 *
 *   orphanShare = 0.6 * blameShare + 0.4 * commitShare
 *   OCS         = orphanShare * log(1 + commits12m) * (1 + inbound)
 *
 * blameShare  = lines last touched by departed authors / total lines
 * commitShare = commits by departed authors in the last 24 months / all commits in that window
 *               (a second signal so a single formatting commit cannot flip ownership)
 * churn       = log(1 + commits in the last 12 months)
 * loadBearing = 1 + number of analysed files that import this one
 *
 * The score shown in the UI is normalised to 0..100 against the riskiest
 * file in the repo so the heatmap always has a usable range.
 */
export function scoreFiles(files: FileStat[], departed: Set<string>): Scored[] {
  const lower = new Set([...departed].map((e) => e.trim().toLowerCase()).filter(Boolean));
  const scored = files.map((f) => {
    let departedLines = 0;
    for (const [email, n] of Object.entries(f.authors)) if (lower.has(email.toLowerCase())) departedLines += n;
    let departedCommits = 0;
    for (const [email, n] of Object.entries(f.commitAuthors ?? {})) if (lower.has(email.toLowerCase())) departedCommits += n;

    const blameShare = f.lines > 0 ? departedLines / f.lines : 0;
    const commitShare = f.commits24m > 0 ? departedCommits / f.commits24m : blameShare;
    const orphanShare = BLAME_WEIGHT * blameShare + COMMIT_WEIGHT * commitShare;
    const churn = Math.log(1 + f.commits12m);
    const loadBearing = 1 + f.inbound;
    const raw = orphanShare * churn * loadBearing;
    return { ...f, departedLines, departedCommits, blameShare, commitShare, orphanShare, churn, loadBearing, raw, score: 0 };
  });
  const max = Math.max(0, ...scored.map((s) => s.raw));
  for (const s of scored) s.score = max > 0 ? Math.round((s.raw / max) * 100) : 0;
  return scored.sort((a, b) => b.score - a.score || b.lines - a.lines);
}

export function scoreColor(score: number): string {
  // Primer-style risk ramp: border grey -> attention amber -> danger red
  if (score <= 0) return "#21262d";
  const t = Math.min(1, score / 100);
  const stops: [number, [number, number, number]][] = [
    [0, [33, 38, 45]],
    [0.25, [110, 84, 20]],
    [0.55, [187, 128, 9]],
    [0.8, [218, 54, 51]],
    [1, [248, 81, 73]],
  ];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const k = (t - t0) / (t1 - t0);
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
