import type { Analysis, CommitEntry, DailyActivity } from "./types.ts";

const DAY = 86_400_000;

export function utcDay(date: string): string | null {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

export function addDailyCommit(days: Map<string, DailyActivity>, date: string, email: string): void {
  const day = utcDay(date);
  if (!day) return;
  const record = days.get(day) ?? { date: day, commits: 0, authors: Object.create(null) as Record<string, number> };
  record.commits++;
  const author = email.trim().toLowerCase();
  if (author) record.authors[author] = (record.authors[author] ?? 0) + 1;
  days.set(day, record);
}

export function dailyFromCommits(commits: Pick<CommitEntry, "date" | "email">[]): DailyActivity[] {
  const days = new Map<string, DailyActivity>();
  for (const commit of commits) addDailyCommit(days, commit.date, commit.email);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function activityWindow(analysis: Pick<Analysis, "activity" | "commits" | "analyzedAt">, windowDays: number, departed: Set<string> = new Set()) {
  const length = Math.min(365, Math.max(1, Math.floor(windowDays) || 30));
  const end = Date.parse(`${utcDay(analysis.analyzedAt) ?? "1970-01-01"}T00:00:00Z`);
  const source = analysis.activity ?? dailyFromCommits(analysis.commits ?? []);
  const indexed = new Map(source.map((day) => [day.date, day]));
  const gone = new Set([...departed].map((email) => email.trim().toLowerCase()));
  const contributors = new Set<string>();
  const days = Array.from({ length }, (_, i) => {
    const date = new Date(end - (length - 1 - i) * DAY).toISOString().slice(0, 10);
    const day = indexed.get(date) ?? { date, commits: 0, authors: {} };
    let departedCommits = 0;
    for (const [email, count] of Object.entries(day.authors)) {
      if (count <= 0) continue;
      contributors.add(email.toLowerCase());
      if (gone.has(email.toLowerCase())) departedCommits += count;
    }
    return { ...day, contributors: Object.values(day.authors).filter((count) => count > 0).length, departedCommits };
  });
  return {
    days,
    commits: days.reduce((sum, day) => sum + day.commits, 0),
    activeDays: days.filter((day) => day.commits > 0).length,
    contributors: contributors.size,
    departedCommits: days.reduce((sum, day) => sum + day.departedCommits, 0),
    partial: analysis.activity === undefined,
  };
}
