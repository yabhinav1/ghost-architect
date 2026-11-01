import { get } from "./db.ts";
import { loadBriefs } from "./explain.ts";
import { cachedAnalysis } from "./org.ts";
import { pendingWork } from "./pending.ts";
import { readiness, type PendingWork } from "./readiness.ts";
import { membership } from "./roles.ts";
import { scoreFiles } from "./score.ts";
import type { BriefResult, Handover, Member, Org } from "./types.ts";

export type PacketFile = {
  path: string;
  done: boolean;
  notes: string;
  links: string[];
  score?: number;
  commits12m?: number;
  inbound?: number;
  purpose?: string;
  risks: string[];
  checklist: string[];
  undocumented: string[];
  evidence: { title: string; url: string; date: string }[];
};

export type Packet = {
  handover: Pick<Handover, "id" | "repoUrl" | "status" | "dueDate" | "createdAt" | "completedAt">;
  org: { name: string; slug: string };
  leaver: { login: string; name: string; email?: string; lastDay?: string };
  receiver: { login: string; name: string };
  files: PacketFile[];
  pending: PendingWork | null;
  pendingError?: string;
  readiness: ReturnType<typeof readiness>;
  quiz: { questions: number; best: { score: number; total: number; at: string } | null; passed: boolean } | null;
  firstWeek: string[];
  /** days until the leaver's last day; negative once they are gone; null when unset */
  daysLeft: number | null;
  generatedAt: string;
};

export const PASS_MARK = 0.8;

export function bestAttempt(h: Handover, login: string) {
  const mine = (h.quiz?.attempts ?? []).filter((a) => a.by === login);
  return mine.reduce<(typeof mine)[number] | null>((best, a) => (!best || a.score / a.total > best.score / best.total ? a : best), null);
}

/** Compile everything the receiver needs on day one into one structure. Pure data; rendered as a page and as Markdown. */
export async function buildPacket(h: Handover, opts: { token?: string; withPending?: boolean } = {}): Promise<Packet> {
  const [org, leaver, receiver, analysis, briefs] = await Promise.all([
    get<Org>("orgs", h.orgId),
    membership(h.orgId, h.leaverLogin),
    membership(h.orgId, h.receiverLogin),
    cachedAnalysis(h.repoUrl),
    loadBriefs(h.repoUrl, h.files.map((f) => f.path)),
  ]);
  const leaverEmail = (leaver?.email ?? h.leaverEmail)?.toLowerCase();
  const scored = analysis ? scoreFiles(analysis.files, new Set(leaverEmail ? [leaverEmail] : [])) : [];
  const byPath = new Map(scored.map((f) => [f.path, f]));
  const briefOf = new Map<string, BriefResult>(briefs.map((b) => [b.file, b]));
  const files: PacketFile[] = h.files.map((f) => {
    const s = byPath.get(f.path);
    const b = briefOf.get(f.path);
    return {
      path: f.path,
      done: f.done,
      notes: f.notes,
      links: f.links,
      score: s?.score,
      commits12m: s?.commits12m,
      inbound: s?.inbound,
      purpose: b?.brief.purpose,
      risks: b?.brief.risks ?? [],
      checklist: b?.brief.safeChangeChecklist ?? [],
      undocumented: b?.brief.undocumented ?? [],
      evidence: (b?.evidence ?? []).slice(0, 4).map((e) => ({ title: e.title, url: e.url, date: e.date })),
    };
  });
  let pending: PendingWork | null = null;
  let pendingError: string | undefined;
  if (opts.withPending !== false) {
    try {
      pending = await pendingWork(h.repoUrl, h.leaverLogin, leaver?.email ?? h.leaverEmail, opts.token);
    } catch (e) {
      pendingError = (e as Error).message;
    }
  }
  const best = bestAttempt(h, h.receiverLogin);
  const quiz = h.quiz ? { questions: h.quiz.questions.length, best: best ? { score: best.score, total: best.total, at: best.at } : null, passed: Boolean(best && best.score / best.total >= PASS_MARK) } : null;
  const firstWeek = [
    `Clone ${h.repoUrl} and run the test suite before touching anything.`,
    ...files.filter((f) => !f.done).slice(0, 3).map((f) => `Walk through ${f.path} with ${leaver?.name ?? h.leaverLogin} while they are still here.`),
    ...(pending?.pullRequests.length ? [`Decide what happens to ${pending.pullRequests.length} open pull request${pending.pullRequests.length === 1 ? "" : "s"}: merge, take over, or close.`] : []),
    ...(pending?.branches.length ? [`Triage ${pending.branches.length} branch${pending.branches.length === 1 ? "" : "es"} with unmerged commits; delete what is dead.`] : []),
    ...(pending?.todos.length ? [`Turn the ${pending.todos.length} authored TODO/FIXME comments into tickets or delete them.`] : []),
    ...(quiz && !quiz.passed ? ["Pass the knowledge check on your handover page."] : []),
    ...files.filter((f) => f.risks.length).slice(0, 2).map((f) => `Read the risks on ${f.path} before your first change there.`),
  ].slice(0, 8);
  return {
    handover: { id: h.id, repoUrl: h.repoUrl, status: h.status, dueDate: h.dueDate, createdAt: h.createdAt, completedAt: h.completedAt },
    org: { name: org?.name ?? "Organisation", slug: org?.slug ?? "" },
    leaver: { login: h.leaverLogin, name: leaver?.name ?? h.leaverLogin, email: leaver?.email ?? h.leaverEmail, lastDay: leaver?.lastDay },
    receiver: { login: h.receiverLogin, name: receiver?.name ?? h.receiverLogin },
    files,
    pending,
    pendingError,
    readiness: readiness(h.files, pending, quiz ? (quiz.passed ? "passed" : "not passed") : undefined),
    quiz,
    firstWeek,
    daysLeft: leaver?.lastDay ? Math.ceil((Date.parse(leaver.lastDay) - Date.now()) / 86_400_000) : null,
    generatedAt: new Date().toISOString(),
  };
}

export function packetMarkdown(p: Packet): string {
  const repo = p.handover.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  const L: string[] = [];
  L.push(`# Day-one packet: ${repo}`, "");
  L.push(`${p.org.name} · ${p.leaver.name} (@${p.leaver.login}) → ${p.receiver.name} (@${p.receiver.login})${p.leaver.lastDay ? ` · last day ${p.leaver.lastDay}` : ""}${p.handover.dueDate ? ` · handover due ${p.handover.dueDate}` : ""}`, "");
  L.push(`Readiness: **${p.readiness.score}/100, ${p.readiness.label}**${p.readiness.reasons.length ? ` (${p.readiness.reasons.join("; ")})` : ""}`, "");
  if (p.quiz) L.push(`Knowledge check: ${p.quiz.best ? `${p.quiz.best.score}/${p.quiz.best.total}${p.quiz.passed ? ", passed" : ", not yet passed"}` : "not attempted"}`, "");
  L.push("## First week", "", ...p.firstWeek.map((s, i) => `${i + 1}. ${s}`), "");
  L.push("## Files you now own", "");
  for (const f of p.files) {
    L.push(`### ${f.done ? "✅" : "⬜"} ${f.path}`);
    const meta = [f.score !== undefined ? `criticality ${f.score}` : null, f.commits12m !== undefined ? `${f.commits12m} commits in 12 months` : null, f.inbound !== undefined ? `${f.inbound} importers` : null].filter(Boolean).join(" · ");
    if (meta) L.push(`_${meta}_`);
    if (f.purpose) L.push("", `**Why it exists.** ${f.purpose}`);
    if (f.notes.trim()) L.push("", `**${p.leaver.name}'s notes.** ${f.notes.trim()}`);
    if (f.risks.length) L.push("", "**Risks**", ...f.risks.map((r) => `- ${r}`));
    if (f.checklist.length) L.push("", "**Before you change it**", ...f.checklist.map((r) => `- [ ] ${r}`));
    if (f.undocumented.length) L.push("", "**Nobody wrote down**", ...f.undocumented.map((r) => `- ${r}`));
    if (f.evidence.length) L.push("", "**Evidence**", ...f.evidence.map((e) => `- [${e.title}](${e.url}) ${e.date.slice(0, 10)}`));
    if (f.links.length) L.push("", "**Links**", ...f.links.map((l) => `- ${l}`));
    L.push("");
  }
  if (p.pending) {
    L.push("## Work in flight", "");
    L.push(`- Open pull requests: ${p.pending.pullRequests.length}`, ...p.pending.pullRequests.map((x) => `  - [#${x.number} ${x.title}](${x.url})`));
    L.push(`- Open issues: ${p.pending.issues.length}`, ...p.pending.issues.map((x) => `  - [#${x.number} ${x.title}](${x.url})`));
    L.push(`- Unmerged branches: ${p.pending.branches.length}`, ...p.pending.branches.map((b) => `  - ${b.name} (${b.unmerged} unmerged, last ${b.lastCommit.slice(0, 10)})`));
    L.push(`- TODO / FIXME: ${p.pending.todos.length}`, ...p.pending.todos.map((t) => `  - ${t.file}:${t.line} ${t.text}`));
    L.push("");
  } else if (p.pendingError) L.push("## Work in flight", "", `_Could not be computed: ${p.pendingError}_`, "");
  L.push(`_Generated ${p.generatedAt.slice(0, 16).replace("T", " ")} UTC by Ghost-Architect._`);
  return L.join("\n");
}

export async function packetAccess(h: Handover, login: string): Promise<boolean> {
  const me = login.toLowerCase();
  if (h.leaverLogin === me || h.receiverLogin === me) return true;
  const m = await membership(h.orgId, me);
  return Boolean(m && (m.role === "owner" || m.role === "manager"));
}

export function sanitizeMember(m: Member | null) {
  return m ? { login: m.login, name: m.name } : null;
}
