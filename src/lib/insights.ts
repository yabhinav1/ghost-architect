import { scoreFiles } from "./score";
import type { Analysis, FileStat, HandoverItem, Receiver, Scored } from "./types";

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

/** The still-here author best placed to inherit a file: most blame lines, then most recent commits. */
export function suggestReceiver(file: FileStat, departed: Set<string>, authors: Analysis["authors"]): Receiver {
  let best: Receiver = null;
  for (const [email, lines] of Object.entries(file.authors)) {
    if (departed.has(email)) continue;
    const commits = file.commitAuthors?.[email] ?? 0;
    if (!best || lines > best.lines || (lines === best.lines && commits > best.commits)) {
      best = { email, name: authors[email]?.name ?? email, lines, commits };
    }
  }
  return best;
}

/** Handover plan for one departing engineer: their files, riskiest first, each with a receiver. */
export function handoverPlan(analysis: Analysis, email: string, extraDeparted: Set<string> = new Set()): HandoverItem[] {
  const departed = new Set([email, ...extraDeparted]);
  const scored = scoreFiles(analysis.files, new Set([email]));
  return scored
    .filter((f) => (f.authors[email] ?? 0) > 0 || (f.commitAuthors?.[email] ?? 0) > 0)
    .map((file) => ({ file, receiver: suggestReceiver(file, departed, analysis.authors) }));
}

/** A CODEOWNERS file proposing a still-here owner for every risky file. GitHub accepts emails as owners. */
export function codeownersText(scored: Scored[], departed: Set<string>, authors: Analysis["authors"], minScore = 30, max = 40): string {
  const rows = scored.filter((f) => f.score >= minScore).slice(0, max);
  const lines = [
    "# CODEOWNERS proposed by Ghost-Architect",
    `# ${rows.length} files with orphaned criticality >= ${minScore}, each assigned to the still-here author with the largest share.`,
    "# Review before merging: blame shows who last edited a line, not who understood it.",
    "",
  ];
  for (const f of rows) {
    const r = suggestReceiver(f, departed, authors);
    const path = "/" + f.path;
    lines.push(r ? `${path} ${r.email}  # score ${f.score}, ${Math.round((r.lines / f.lines) * 100)}% of lines` : `${path}  # score ${f.score}, NO remaining author: needs a volunteer`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Approximate score as of a past date, from commit timelines only (blame is not available for the past).
 * orphan share = departed authors' share of commits in the 24 months before asOf.
 */
export function scoreFilesAt(files: FileStat[], departed: Set<string>, asOf: Date): Scored[] {
  const t = asOf.getTime();
  const iso = asOf.toISOString().slice(0, 10);
  const cut12 = new Date(t - 12 * MONTH_MS).toISOString().slice(0, 10);
  const cut24 = new Date(t - 24 * MONTH_MS).toISOString().slice(0, 10);
  const scored = files.map((f) => {
    let c12 = 0;
    let c24 = 0;
    let gone24 = 0;
    for (const c of f.timeline ?? []) {
      if (c.d > iso || c.d < cut24) continue;
      c24++;
      if (departed.has(c.a)) gone24++;
      if (c.d >= cut12) c12++;
    }
    const commitShare = c24 > 0 ? gone24 / c24 : 0;
    const churn = Math.log(1 + c12);
    const loadBearing = 1 + f.inbound;
    const raw = commitShare * churn * loadBearing;
    return { ...f, departedLines: 0, departedCommits: gone24, blameShare: commitShare, commitShare, orphanShare: commitShare, churn, loadBearing, raw, score: 0, commits12m: c12, commits24m: c24 };
  });
  const max = Math.max(0, ...scored.map((s) => s.raw));
  for (const s of scored) s.score = max > 0 ? Math.round((s.raw / max) * 100) : 0;
  return scored.sort((a, b) => b.score - a.score || b.lines - a.lines);
}

export type DecayPoint = { month: number; absorbed: number };

/**
 * Knowledge absorption for one departed author: of the files they touched, what share has been
 * edited by someone else in the N months after their last commit. Flat line = knowledge is rotting.
 */
export function decayCurve(files: FileStat[], email: string, months = 12): { lastCommit: string; files: number; points: DecayPoint[] } | null {
  const mine = files.filter((f) => (f.timeline ?? []).some((c) => c.a === email));
  if (mine.length === 0) return null;
  let last = "";
  for (const f of mine) for (const c of f.timeline) if (c.a === email && c.d > last) last = c.d;
  const lastT = Date.parse(last);
  const now = Date.now();
  const points: DecayPoint[] = [];
  for (let m = 0; m <= months; m++) {
    const until = lastT + m * MONTH_MS;
    if (until > now + MONTH_MS) break;
    const untilIso = new Date(Math.min(until, now)).toISOString().slice(0, 10);
    const touched = mine.filter((f) => f.timeline.some((c) => c.a !== email && c.d > last && c.d <= untilIso)).length;
    points.push({ month: m, absorbed: touched / mine.length });
  }
  return { lastCommit: last, files: mine.length, points };
}
