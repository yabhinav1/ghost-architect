import type { FileStat, Scored } from "./types";

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
  // grey -> amber -> red
  if (score <= 0) return "#2a2a2e";
  const t = Math.min(1, score / 100);
  const r = Math.round(60 + 195 * t);
  const g = Math.round(60 + 110 * (1 - t) * t * 2);
  const b = Math.round(70 * (1 - t));
  return `rgb(${r},${g},${b})`;
}
