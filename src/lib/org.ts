import fs from "node:fs/promises";
import { del, get, list, newId, put } from "./db.ts";
import { cacheDir, normalizeRepoUrl, repoKey } from "./git.ts";
import { portfolioSummary, type PortfolioSummary } from "./insights.ts";
import { renderEmail } from "./email-template.ts";
import { appUrl, deliverable, sendMail } from "./mail.ts";
import { audit, membersOf } from "./roles.ts";
import { storeGet } from "./store.ts";
import type { Analysis, Handover, HandoverFile, Invite, Member, Notice, NoticeType, Org, OrgRepo, OrgRole } from "./types.ts";

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";
}

export async function createOrg(name: string, by: { login: string; name: string; avatar?: string }): Promise<Org> {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await list<Org>("orgs", (o) => o.slug === slug).then((r) => r.length); i++) slug = `${base}-${i}`;
  const org: Org = { id: newId("org_"), slug, name: name.trim().slice(0, 80), createdBy: by.login, createdAt: new Date().toISOString(), supportAccess: false };
  await put("orgs", org);
  await put<Member>("members", { id: `${org.id}:${by.login.toLowerCase()}`, orgId: org.id, login: by.login.toLowerCase(), name: by.name, avatar: by.avatar, role: "owner", status: "active", joinedAt: org.createdAt });
  await audit(org.id, by.login, "org.create", org.slug);
  return org;
}

export async function createInvite(org: Org, by: string, role: OrgRole, login?: string): Promise<Invite> {
  const inv: Invite = { id: newId("inv_"), orgId: org.id, role, login: login?.toLowerCase().replace(/^@/, "") || undefined, createdBy: by, createdAt: new Date().toISOString() };
  await put("invites", inv);
  await audit(org.id, by, "invite.create", inv.login ?? "(open link)", { role });
  return inv;
}

export async function acceptInvite(token: string, user: { login: string; name: string; avatar?: string }): Promise<{ org: Org; member: Member } | { error: string }> {
  const inv = await get<Invite>("invites", token);
  if (!inv) return { error: "This invite link is not valid." };
  if (inv.acceptedAt) return { error: "This invite was already used." };
  if (inv.login && inv.login !== user.login.toLowerCase()) return { error: `This invite is for @${inv.login}.` };
  const org = await get<Org>("orgs", inv.orgId);
  if (!org) return { error: "The organisation no longer exists." };
  const member: Member = { id: `${org.id}:${user.login.toLowerCase()}`, orgId: org.id, login: user.login.toLowerCase(), name: user.name, avatar: user.avatar, role: inv.role, status: "active", joinedAt: new Date().toISOString() };
  await put("members", member);
  await put<Invite>("invites", { ...inv, acceptedBy: user.login, acceptedAt: member.joinedAt });
  await audit(org.id, user.login, "invite.accept", org.slug, { role: inv.role });
  return { org, member };
}

export async function reposOf(orgId: string): Promise<OrgRepo[]> {
  return (await list<OrgRepo>("orgRepos", (r) => r.orgId === orgId)).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function addRepo(org: Org, repoUrl: string, by: string): Promise<OrgRepo> {
  const url = normalizeRepoUrl(repoUrl);
  const rec: OrgRepo = { id: `${org.id}:${repoKey(url)}`, orgId: org.id, repoUrl: url, addedBy: by, addedAt: new Date().toISOString() };
  await put("orgRepos", rec);
  await audit(org.id, by, "repo.add", url);
  return rec;
}

export async function removeRepo(org: Org, repoUrl: string, by: string): Promise<void> {
  const url = normalizeRepoUrl(repoUrl);
  await del("orgRepos", `${org.id}:${repoKey(url)}`);
  await audit(org.id, by, "repo.remove", url);
}

/** A cached analysis without cloning anything; null when the repo has not been analysed on this server. */
export async function cachedAnalysis(repoUrl: string): Promise<Analysis | null> {
  const url = normalizeRepoUrl(repoUrl);
  try {
    return JSON.parse(await fs.readFile(cacheDir("analysis", repoKey(url) + ".json"), "utf8")) as Analysis;
  } catch {
    return storeGet<Analysis>(`analysis:${repoKey(url)}`);
  }
}

export type ActivityEvent = { date: string; repoUrl: string; slug: string; sha: string; subject: string; files: number; email: string; name: string; member: Member | null };

/** Commit log across the organisation's repos, newest first, each commit matched to a member by git email. */
export async function activityFeed(org: Org, limit = 300): Promise<{ events: ActivityEvent[]; unmatchedEmails: Record<string, { name: string; commits: number }>; analysed: number; total: number }> {
  const [repos, members] = await Promise.all([reposOf(org.id), membersOf(org.id)]);
  const byEmail = new Map<string, Member>();
  for (const m of members) if (m.email) byEmail.set(m.email.toLowerCase(), m);
  const events: ActivityEvent[] = [];
  const unmatched: Record<string, { name: string; commits: number }> = {};
  let analysed = 0;
  for (const r of repos) {
    const a = await cachedAnalysis(r.repoUrl);
    if (!a) continue;
    analysed++;
    const slug = a.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
    for (const c of a.commits ?? []) {
      const member = byEmail.get(c.email) ?? null;
      if (!member) {
        const u = (unmatched[c.email] ??= { name: c.name, commits: 0 });
        u.commits++;
      }
      events.push({ date: c.date, repoUrl: a.repoUrl, slug, sha: c.sha, subject: c.subject, files: c.files, email: c.email, name: c.name, member });
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { events: events.slice(0, limit), unmatchedEmails: unmatched, analysed, total: repos.length };
}

export async function repoSummaries(org: Org): Promise<{ repo: OrgRepo; summary: PortfolioSummary | null }[]> {
  const repos = await reposOf(org.id);
  const out: { repo: OrgRepo; summary: PortfolioSummary | null }[] = [];
  for (const repo of repos) {
    const a = await cachedAnalysis(repo.repoUrl);
    out.push({ repo, summary: a ? portfolioSummary(a) : null });
  }
  return out;
}

export const NOTICE_TEMPLATES: Record<NoticeType, { label: string; subject: string; body: string }> = {
  general: { label: "General notice", subject: "A note from {org}", body: "Hi {name},\n\n{message}\n\nRegards,\n{org}" },
  "notice-period": { label: "Notice period acknowledgement", subject: "Your notice period at {org}", body: "Hi {name},\n\nThis confirms your notice period at {org}. Your last working day is {lastDay}.\n\nDuring this period please complete the handover plan assigned to you in Ghost-Architect: walk the receiving engineer through each listed file, record notes and links against each one, and tick them off as you go. Your manager will review progress before your last day.\n\nThank you for your work with us.\n\n{org}" },
  layoff: { label: "Position affected (layoff)", subject: "Important: changes to your role at {org}", body: "Dear {name},\n\nWe regret to inform you that your position at {org} is affected by organisational changes. Your last working day will be {lastDay}.\n\nTo make this transition fair to you and safe for the team, a handover plan has been prepared in Ghost-Architect. Please complete it before your last day; your manager is available to help.\n\nDetails of your final settlement will follow separately.\n\nWith appreciation for your contributions,\n{org}" },
  "kt-request": { label: "Knowledge transfer request", subject: "Knowledge transfer: {repo}", body: "Hi {name},\n\nYou are the main contributor to several critical files in {repo}. Please complete the knowledge-transfer plan in Ghost-Architect: for each file, add a short note on why it exists, any gotchas, and links to docs or tickets, then schedule a walkthrough with the receiving engineer.\n\nThanks,\n{org}" },
  handover: { label: "Handover assignment", subject: "Handover assigned: {repo}", body: "Hi {name},\n\nA handover for {repo} has been assigned to you in Ghost-Architect. Open your inbox to see the files, the other engineer involved, and the due date.\n\n{org}" },
  warning: { label: "Formal warning", subject: "Formal notice from {org}", body: "Dear {name},\n\n{message}\n\nPlease acknowledge receipt of this notice in Ghost-Architect.\n\n{org}" },
};

export function fillTemplate(text: string, vars: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export async function sendNotice(org: Org, by: string, input: { toLogin: string; type: NoticeType; subject: string; body: string; handoverId?: string }): Promise<Notice> {
  const n: Notice = { id: newId("n_"), orgId: org.id, toLogin: input.toLogin.toLowerCase(), type: input.type, subject: input.subject.slice(0, 200), body: input.body.slice(0, 20000), status: "sent", createdBy: by, createdAt: new Date().toISOString(), handoverId: input.handoverId };
  await put("notices", n);
  await audit(org.id, by, "notice.send", n.toLogin, { type: n.type, id: n.id });
  const to = await get<Member>("members", `${org.id}:${n.toLogin}`);
  if (deliverable(to?.email)) {
    const label = NOTICE_TEMPLATES[n.type]?.label ?? "Notice";
    const email = renderEmail({
      appUrl: appUrl(),
      preheader: n.body.slice(0, 120),
      kicker: org.name,
      heading: n.subject,
      meta: `${label} · from @${by} · ${n.createdAt.slice(0, 10)}`,
      blocks: [{ kind: "quote", text: n.body }, ...(n.handoverId ? [{ kind: "callout" as const, tone: "info" as const, text: "A handover workspace is attached: the files, your notes and the knowledge check live on your inbox page." }] : [])],
      cta: { label: "Read and acknowledge", url: `${appUrl()}/me` },
      secondary: [{ label: "Printable letter", url: `${appUrl()}/letter/${n.id}` }, ...(n.handoverId ? [{ label: "Open the handover", url: `${appUrl()}/me#handover-${n.handoverId}` }] : [])],
      reason: `You are receiving this because you are a member of ${org.name} on Ghost-Architect.`,
    });
    void sendMail({ to: to.email, subject: `[${org.name}] ${n.subject}`, ...email });
  }
  return n;
}

export async function noticesOf(orgId: string): Promise<Notice[]> {
  return (await list<Notice>("notices", (n) => n.orgId === orgId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function inboxOf(login: string): Promise<(Notice & { orgName: string; orgSlug: string })[]> {
  const mine = (await list<Notice>("notices", (n) => n.toLogin === login.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: (Notice & { orgName: string; orgSlug: string })[] = [];
  for (const n of mine) {
    const org = await get<Org>("orgs", n.orgId);
    out.push({ ...n, orgName: org?.name ?? "Unknown organisation", orgSlug: org?.slug ?? "" });
  }
  return out;
}

/** Files to hand over: the leaver's files in the repo, riskiest first, from the cached analysis. */
export function suggestHandoverFiles(a: Analysis, leaverEmail: string | undefined, max = 15): HandoverFile[] {
  const email = leaverEmail?.toLowerCase();
  const scored = a.files
    .map((f) => {
      const mine = email ? (f.authors[email] ?? 0) : 0;
      const share = f.lines ? mine / f.lines : 0;
      const recent = email ? (f.commitAuthors?.[email] ?? 0) : 0;
      return { path: f.path, weight: (share + (f.commits24m ? recent / f.commits24m : 0)) * Math.log(2 + f.commits12m) * (1 + f.inbound), share, recent };
    })
    .filter((x) => x.share > 0 || x.recent > 0)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, max);
  return scored.map((x) => ({ path: x.path, done: false, notes: "", links: [] }));
}

export async function createHandover(org: Org, by: string, input: { repoUrl: string; leaverLogin: string; receiverLogin: string; dueDate?: string; files?: string[] }): Promise<Handover> {
  const url = normalizeRepoUrl(input.repoUrl);
  const leaver = await get<Member>("members", `${org.id}:${input.leaverLogin.toLowerCase()}`);
  const a = await cachedAnalysis(url);
  let files: HandoverFile[];
  if (input.files?.length) files = input.files.slice(0, 50).map((p) => ({ path: p, done: false, notes: "", links: [] }));
  else if (a) files = suggestHandoverFiles(a, leaver?.email);
  else files = [];
  const h: Handover = { id: newId("h_"), orgId: org.id, repoUrl: url, leaverLogin: input.leaverLogin.toLowerCase(), leaverEmail: leaver?.email, receiverLogin: input.receiverLogin.toLowerCase(), files, dueDate: input.dueDate, status: "open", createdBy: by, createdAt: new Date().toISOString() };
  await put("handovers", h);
  await audit(org.id, by, "handover.create", `${h.leaverLogin} -> ${h.receiverLogin}`, { repoUrl: url, files: files.length, id: h.id });
  return h;
}

export async function handoversOf(orgId: string): Promise<Handover[]> {
  return (await list<Handover>("handovers", (h) => h.orgId === orgId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function handoversFor(login: string): Promise<(Handover & { orgName: string; orgSlug: string; mine: "leaver" | "receiver" })[]> {
  const l = login.toLowerCase();
  const mine = (await list<Handover>("handovers", (h) => h.leaverLogin === l || h.receiverLogin === l)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: (Handover & { orgName: string; orgSlug: string; mine: "leaver" | "receiver" })[] = [];
  for (const h of mine) {
    const org = await get<Org>("orgs", h.orgId);
    out.push({ ...h, orgName: org?.name ?? "Unknown organisation", orgSlug: org?.slug ?? "", mine: h.leaverLogin === l ? "leaver" : "receiver" });
  }
  return out;
}
