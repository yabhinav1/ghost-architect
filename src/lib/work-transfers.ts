import { createHash } from "node:crypto";
import { z } from "zod";
import { get, list, newId, put, update } from "./db.ts";
import { normalizeRepoUrl } from "./git.ts";
import { membership, canManage } from "./roles.ts";
import type { Org, WorkTransfer } from "./types.ts";

type Actor = { login: string; token: string };
export class TransferError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const transferInput = z.object({
  recipientEmail: z.string().trim().email().max(254).transform((s) => s.toLowerCase()),
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(1).max(20000),
  repoUrl: z.string().trim().min(1).max(500),
  branch: z.string().trim().max(200).default(""),
  orgId: z.string().max(100).optional(),
}).strict();

function headers(token: string) {
  if (!token) throw new TransferError("Connect your GitHub account to transfer work.", 403);
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ghost-architect", "X-GitHub-Api-Version": "2022-11-28" };
}
const emailCache = new Map<string, { at: number; emails: string[] }>();
/** Only GitHub-verified addresses count. Member/git emails are never identity evidence. */
export async function verifiedEmails(token: string, fresh = false): Promise<string[]> {
  if (!token) return [];
  const key = createHash("sha256").update(token).digest("hex");
  const cached = emailCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < 120000) return cached.emails;
  const res = await fetch("https://api.github.com/user/emails?per_page=100", { headers: headers(token), cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new TransferError("Email handoffs could not be checked. Reconnect GitHub with email read permission (OAuth: user:email; GitHub App: Email addresses, read-only), then try again.", 403);
  const rows: unknown = await res.json();
  if (!Array.isArray(rows)) throw new TransferError("GitHub returned an invalid email response.", 502);
  const emails = rows.filter((r) => r.verified === true && typeof r.email === "string").map((r) => r.email.trim().toLowerCase());
  for (const [k, v] of emailCache) if (Date.now() - v.at >= 120000) emailCache.delete(k);
  emailCache.set(key, { at: Date.now(), emails });
  return emails;
}

async function orgReceiver(orgId: string, login: string): Promise<boolean> {
  const member = await membership(orgId, login);
  return !!member && member.status !== "left" && canManage(member.role);
}
export async function isRecipient(t: WorkTransfer, login: string, emails: string[]): Promise<boolean> {
  const matches = t.recipientLogin ? t.recipientLogin === login.toLowerCase() : emails.includes(t.recipientEmail);
  return matches && (!t.orgId || await orgReceiver(t.orgId, login));
}

async function repoInfo(repoUrl: string, actor: Actor) {
  const url = normalizeRepoUrl(repoUrl);
  const slug = url.slice("https://github.com/".length);
  const res = await fetch(`https://api.github.com/repos/${slug}`, { headers: headers(actor.token), cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new TransferError("GitHub could not verify your access to this repository. Check your connection and repository permissions.", 403);
  return { url, slug, info: await res.json() as { permissions?: { admin?: boolean; push?: boolean }; owner?: { type?: string } } };
}

export async function createTransfer(actor: Actor, raw: unknown): Promise<WorkTransfer> {
  const parsed = transferInput.safeParse(raw);
  if (!parsed.success) throw new TransferError("Provide a valid recipient email, repository, title and handoff notes (up to 20,000 characters).");
  const input = parsed.data;
  if ((await verifiedEmails(actor.token, true)).includes(input.recipientEmail)) throw new TransferError("Choose another person's verified GitHub email to hand off work.");
  let org: Org | null = null;
  if (input.orgId) {
    const member = await membership(input.orgId, actor.login);
    org = await get<Org>("orgs", input.orgId);
    if (!org || !member || member.status === "left") throw new TransferError("You must be a current member of this organisation.", 403);
  }
  const { url, info } = await repoInfo(input.repoUrl, actor);
  // Read access alone does not authorise a user to redistribute another team's private work.
  if (!info.permissions?.push && !info.permissions?.admin) throw new TransferError("You need write or admin access to hand off this repository's work.", 403);
  const now = new Date().toISOString();
  return put("workTransfers", {
    id: newId("wt_"), senderLogin: actor.login.toLowerCase(), recipientEmail: input.recipientEmail,
    orgId: org?.id, orgName: org?.name, repoUrl: url, title: input.title, notes: input.notes, branch: input.branch,
    status: "pending", createdAt: now, updatedAt: now, senderReadAt: now,
  });
}

export async function transfersFor(actor: Actor) {
  let emails: string[] = [], emailWarning: string | undefined;
  try { emails = await verifiedEmails(actor.token); }
  catch (e) { emailWarning = e instanceof TransferError ? e.message : "GitHub email verification is temporarily unavailable. Try again shortly."; }
  if (!actor.token) emailWarning = "Developer sign-in cannot receive email-addressed work. Connect a real GitHub account.";
  else if (!emails.length && !emailWarning) emailWarning = "Add and verify your recipient email in GitHub Settings → Emails to receive handoffs.";
  const mine = [];
  for (const t of await list<WorkTransfer>("workTransfers")) {
    const incoming = await isRecipient(t, actor.login, emails);
    if (t.senderLogin === actor.login.toLowerCase() || incoming) mine.push({ ...t, incoming });
  }
  return { transfers: mine.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), emailWarning };
}

export async function changeTransfer(actor: Actor, id: string, action: "read" | "accept" | "decline" | "cancel") {
  // Re-check GitHub for mutations; a previously verified address may have been removed.
  const existing = await get<WorkTransfer>("workTransfers", id);
  if (!existing) throw new TransferError("Handoff not found.", 404);
  const sender = existing.senderLogin === actor.login.toLowerCase();
  const emails = !sender && !existing.recipientLogin ? await verifiedEmails(actor.token, true) : [];
  const result = await update<WorkTransfer>("workTransfers", id, async (t) => {
    const recipient = await isRecipient(t, actor.login, emails);
    if (!sender && !recipient) throw new TransferError("Handoff not found.", 404);
    const now = new Date().toISOString();
    if (action === "read") return sender ? { ...t, senderReadAt: now } : { ...t, recipientLogin: actor.login.toLowerCase(), recipientReadAt: now };
    if (action === "cancel" ? !sender : !recipient || sender) throw new TransferError("You cannot perform this action.", 403);
    if (t.status !== "pending") throw new TransferError("This handoff has already been resolved. Refresh your inbox.", 409);
    const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
    return { ...t, status, updatedAt: now,
      recipientLogin: recipient ? actor.login.toLowerCase() : t.recipientLogin,
      senderReadAt: sender ? now : undefined, recipientReadAt: recipient ? now : undefined };
  });
  if (!result) throw new TransferError("Handoff not found.", 404);
  return result;
}

/** Explicit, sender-triggered write access invitation; never a repository ownership transfer. */
export async function inviteTransferCollaborator(actor: Actor, id: string) {
  const result = await update<WorkTransfer>("workTransfers", id, async (t) => {
    if (t.senderLogin !== actor.login.toLowerCase()) throw new TransferError("Handoff not found.", 404);
    if (t.status !== "accepted" || !t.recipientLogin) throw new TransferError("The recipient must accept the handoff first.", 409);
    if (t.orgId && !await orgReceiver(t.orgId, t.recipientLogin)) throw new TransferError("The recipient is no longer an organisation manager.", 403);
    if (t.githubAccess) return t;
    const { slug, info } = await repoInfo(t.repoUrl, actor);
    if (!info.permissions?.admin) throw new TransferError("Only a repository admin can invite collaborators. Ask an admin to grant access on GitHub.", 403);
    const permission = await fetch(`https://api.github.com/repos/${slug}/collaborators/${encodeURIComponent(t.recipientLogin)}/permission`, { headers: headers(actor.token), cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (permission.ok) {
      const current = await permission.json() as { permission?: string; user?: { permissions?: { push?: boolean; admin?: boolean } } };
      if (current.user?.permissions?.push || current.user?.permissions?.admin || ["write", "admin", "maintain"].includes(current.permission ?? "")) {
        return { ...t, githubAccess: "already-access", updatedAt: new Date().toISOString(), senderReadAt: new Date().toISOString(), recipientReadAt: undefined };
      }
    } else if (permission.status !== 404) throw new TransferError("GitHub could not verify existing collaborator permissions. Check access settings before retrying.", 403);
    const res = await fetch(`https://api.github.com/repos/${slug}/collaborators/${encodeURIComponent(t.recipientLogin)}`, {
      method: "PUT", headers: { ...headers(actor.token), "Content-Type": "application/json" },
      body: JSON.stringify({ permission: "push" }), signal: AbortSignal.timeout(15000),
    });
    if (res.status !== 201 && res.status !== 204) throw new TransferError("GitHub did not confirm the invitation. Your token may lack repository Administration (write) permission, or organisation policy may block invitations. Check GitHub access settings before retrying.", 403);
    return { ...t, githubAccess: res.status === 201 ? "invited" : "already-access", updatedAt: new Date().toISOString(), senderReadAt: new Date().toISOString(), recipientReadAt: undefined };
  });
  if (!result) throw new TransferError("Handoff not found.", 404);
  return result;
}
