import { createHash } from "node:crypto";
import { z } from "zod";
import { get, list, newId, put, update } from "./db.ts";
import { normalizeRepoUrl } from "./git.ts";
import { appUrl, sendMail } from "./mail.ts";
import { membership, canManage } from "./roles.ts";
import { seal, unseal } from "./session-crypto.ts";
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
  /** GitHub access to grant automatically when the recipient accepts */
  access: z.enum(["none", "push", "admin"]).default("none"),
  /** also transfer repository ownership on GitHub when they accept */
  ownership: z.boolean().default(false),
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
  const wantsGrant = input.access !== "none" || input.ownership;
  if (wantsGrant && !info.permissions?.admin) throw new TransferError("Only a repository admin can grant access or transfer ownership. Send the handoff without GitHub changes, or ask an admin.", 403);
  if (input.ownership && info.owner?.type === "Organization") throw new TransferError("Ownership of an organisation-owned repository is transferred by an organisation owner on GitHub, not through a personal token.", 403);
  const now = new Date().toISOString();
  const t = await put<WorkTransfer>("workTransfers", {
    id: newId("wt_"), senderLogin: actor.login.toLowerCase(), recipientEmail: input.recipientEmail,
    orgId: org?.id, orgName: org?.name, repoUrl: url, title: input.title, notes: input.notes, branch: input.branch,
    status: "pending", createdAt: now, updatedAt: now, senderReadAt: now,
    grant: { access: input.access, ownership: input.ownership },
    // The grant runs when the recipient accepts, when the sender is not around: keep their token sealed until then.
    sealedGrant: wantsGrant ? seal({ token: actor.token, login: actor.login.toLowerCase(), at: now }) : undefined,
  });
  const grantLine = input.ownership ? "On accepting, repository ownership on GitHub will be transferred to you (GitHub will email you to confirm)." : input.access !== "none" ? `On accepting, you will be added as a collaborator with ${input.access === "admin" ? "admin" : "write"} access.` : "";
  void sendMail({
    to: input.recipientEmail,
    subject: `@${actor.login} is handing work over to you: ${input.title}`,
    text: `${actor.login} is handing over unfinished work on ${url}${input.branch ? ` (${input.branch})` : ""}.\n\n${input.notes.slice(0, 1500)}\n\n${grantLine ? grantLine + "\n\n" : ""}Sign in with the GitHub account that owns ${input.recipientEmail} to accept or decline: ${appUrl()}/me#transfer-${t.id}`,
  });
  return t;
}

type Grant = { token: string; login: string; at: string };

async function currentAccess(slug: string, login: string, token: string): Promise<"admin" | "push" | "read" | "none"> {
  const res = await fetch(`https://api.github.com/repos/${slug}/collaborators/${encodeURIComponent(login)}/permission`, { headers: headers(token), cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return "none";
  if (!res.ok) throw new TransferError("GitHub could not verify existing collaborator permissions.", 403);
  const j = await res.json() as { permission?: string; user?: { permissions?: { push?: boolean; admin?: boolean } } };
  if (j.user?.permissions?.admin || j.permission === "admin") return "admin";
  if (j.user?.permissions?.push || ["write", "maintain"].includes(j.permission ?? "")) return "push";
  return j.permission === "none" ? "none" : "read";
}

/** Add (or upgrade) a collaborator. 201 = invitation created, 204 = already had it or updated. */
async function addCollaborator(slug: string, login: string, permission: "push" | "admin", token: string): Promise<"invited" | "already-access"> {
  const have = await currentAccess(slug, login, token);
  if (have === "admin" || (have === "push" && permission === "push")) return "already-access";
  const res = await fetch(`https://api.github.com/repos/${slug}/collaborators/${encodeURIComponent(login)}`, {
    method: "PUT", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ permission }), signal: AbortSignal.timeout(15000),
  });
  if (res.status === 201) return "invited";
  if (res.status === 204) return "already-access";
  const detail = await res.json().catch(() => ({})) as { message?: string };
  throw new TransferError(`GitHub refused the collaborator invitation (${res.status}${detail.message ? `: ${detail.message}` : ""}). The token may lack repository Administration (write) permission, or organisation policy may block invitations.`, 403);
}

/** Ask GitHub to move the repository to the new owner. GitHub emails them; the move completes when they accept. */
async function transferOwnership(slug: string, newOwner: string, token: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${slug}/transfer`, {
    method: "POST", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ new_owner: newOwner }), signal: AbortSignal.timeout(15000),
  });
  if (res.status === 202) return;
  const detail = await res.json().catch(() => ({})) as { message?: string };
  throw new TransferError(`GitHub refused the ownership transfer (${res.status}${detail.message ? `: ${detail.message}` : ""}). Only the repository owner can transfer it, and the token needs the repo scope or Administration (write).`, 403);
}

/**
 * Runs the sender's chosen GitHub changes with the sealed token once the recipient has accepted.
 * The token is dropped afterwards whatever happened; a failure leaves the sender a manual retry.
 */
async function runGrant(t: WorkTransfer): Promise<WorkTransfer> {
  if (!t.grant || !t.recipientLogin || (t.grant.access === "none" && !t.grant.ownership)) return { ...t, sealedGrant: undefined };
  const g = t.sealedGrant ? unseal<Grant>(t.sealedGrant) : null;
  const now = new Date().toISOString();
  if (!g?.token) return { ...t, sealedGrant: undefined, githubAccess: "failed", grantError: "The sender's authorisation expired; ask them to grant access from their sent handoffs.", grantRanAt: now };
  const slug = t.repoUrl.slice("https://github.com/".length);
  let next: WorkTransfer = { ...t, sealedGrant: undefined, grantRanAt: now, grantError: undefined };
  try {
    if (t.grant.access !== "none") next.githubAccess = await addCollaborator(slug, t.recipientLogin, t.grant.access, g.token);
    if (t.grant.ownership) {
      await transferOwnership(slug, t.recipientLogin, g.token);
      next.ownership = "requested";
    }
  } catch (e) {
    next = { ...next, grantError: (e as Error).message };
    if (t.grant.access !== "none" && !next.githubAccess) next.githubAccess = "failed";
    if (t.grant.ownership && next.ownership !== "requested") next.ownership = "failed";
  }
  return next;
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
    if (t.senderLogin === actor.login.toLowerCase() || incoming) mine.push({ ...t, sealedGrant: undefined, incoming });
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
    const next: WorkTransfer = { ...t, status, updatedAt: now,
      recipientLogin: recipient ? actor.login.toLowerCase() : t.recipientLogin,
      senderReadAt: sender ? now : undefined, recipientReadAt: recipient ? now : undefined };
    return action === "accept" ? runGrant(next) : { ...next, sealedGrant: undefined };
  });
  if (!result) throw new TransferError("Handoff not found.", 404);
  return result;
}

/** Sender-triggered ownership transfer after acceptance, with their live token. */
export async function transferTransferOwnership(actor: Actor, id: string) {
  const result = await update<WorkTransfer>("workTransfers", id, async (t) => {
    if (t.senderLogin !== actor.login.toLowerCase()) throw new TransferError("Handoff not found.", 404);
    if (t.status !== "accepted" || !t.recipientLogin) throw new TransferError("The recipient must accept the handoff first.", 409);
    if (t.ownership === "requested") return t;
    const { slug, info } = await repoInfo(t.repoUrl, actor);
    if (!info.permissions?.admin) throw new TransferError("Only the repository owner can transfer it.", 403);
    if (info.owner?.type === "Organization") throw new TransferError("Organisation-owned repositories are transferred by an organisation owner on GitHub.", 403);
    await transferOwnership(slug, t.recipientLogin, actor.token);
    return { ...t, ownership: "requested", grantError: undefined, updatedAt: new Date().toISOString(), recipientReadAt: undefined };
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
    if (t.githubAccess && t.githubAccess !== "failed") return t;
    const { slug, info } = await repoInfo(t.repoUrl, actor);
    if (!info.permissions?.admin) throw new TransferError("Only a repository admin can invite collaborators. Ask an admin to grant access on GitHub.", 403);
    const level = t.grant?.access === "admin" ? "admin" : "push";
    const githubAccess = await addCollaborator(slug, t.recipientLogin, level, actor.token);
    return { ...t, githubAccess, grantError: undefined, updatedAt: new Date().toISOString(), senderReadAt: new Date().toISOString(), recipientReadAt: undefined };
  });
  if (!result) throw new TransferError("Handoff not found.", 404);
  return result;
}
