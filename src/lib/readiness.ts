/** Client-safe types and the readiness score for a handover (no Node imports). */
export type PendingBranch = { name: string; unmerged: number; lastCommit: string };
export type PendingTodo = { file: string; line: number; text: string; date: string };
export type PendingItem = { number: number; title: string; url: string; updatedAt: string; kind: "pr" | "issue" };
export type PendingWork = {
  repoUrl: string;
  login: string;
  email?: string;
  pullRequests: PendingItem[];
  issues: PendingItem[];
  branches: PendingBranch[];
  todos: PendingTodo[];
  computedAt: string;
  notes: string[];
};

/** 0..100: how safely this person can leave, from the handover and their pending work. */
export function readiness(files: { done: boolean; notes: string }[], pending: PendingWork | null): { score: number; label: "not ready" | "in progress" | "nearly" | "ready"; reasons: string[] } {
  const reasons: string[] = [];
  const n = files.length || 1;
  const doneShare = files.filter((f) => f.done).length / n;
  const notedShare = files.filter((f) => f.notes.trim().length > 20).length / n;
  let score = Math.round(doneShare * 55 + notedShare * 25);
  if (files.length === 0) reasons.push("no files in the handover");
  else {
    if (doneShare < 1) reasons.push(`${files.length - files.filter((f) => f.done).length} files not walked through`);
    if (notedShare < 0.5) reasons.push("most files have no notes");
  }
  if (pending) {
    const open = pending.pullRequests.length + pending.issues.length + pending.branches.length;
    const penalty = Math.min(20, open * 4 + Math.min(10, pending.todos.length));
    score = Math.max(0, score + 20 - penalty);
    if (pending.pullRequests.length) reasons.push(`${pending.pullRequests.length} open pull request${pending.pullRequests.length > 1 ? "s" : ""}`);
    if (pending.issues.length) reasons.push(`${pending.issues.length} assigned issue${pending.issues.length > 1 ? "s" : ""}`);
    if (pending.branches.length) reasons.push(`${pending.branches.length} branch${pending.branches.length > 1 ? "es" : ""} with unmerged work`);
    if (pending.todos.length) reasons.push(`${pending.todos.length} TODO/FIXME they wrote`);
  }
  const label = score >= 85 ? "ready" : score >= 60 ? "nearly" : score >= 25 ? "in progress" : "not ready";
  return { score: Math.min(100, score), label, reasons };
}
