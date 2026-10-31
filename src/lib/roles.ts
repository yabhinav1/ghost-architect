import { get, list, put, newId } from "./db.ts";
import type { AuditEntry, Member, Org, OrgRole } from "./types.ts";

/** Platform administrators: comma-separated GitHub logins in ADMIN_LOGINS. */
export function isAdmin(login: string | null | undefined): boolean {
  if (!login) return false;
  const admins = (process.env.ADMIN_LOGINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(login.toLowerCase());
}

export async function orgBySlug(slug: string): Promise<Org | null> {
  const orgs = await list<Org>("orgs", (o) => o.slug === slug.toLowerCase());
  return orgs[0] ?? null;
}

export async function membership(orgId: string, login: string): Promise<Member | null> {
  return get<Member>("members", `${orgId}:${login.toLowerCase()}`);
}

export async function membersOf(orgId: string): Promise<Member[]> {
  return (await list<Member>("members", (m) => m.orgId === orgId)).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export async function orgsOf(login: string): Promise<{ org: Org; member: Member }[]> {
  const mine = await list<Member>("members", (m) => m.login === login.toLowerCase());
  const out: { org: Org; member: Member }[] = [];
  for (const m of mine) {
    const org = await get<Org>("orgs", m.orgId);
    if (org) out.push({ org, member: m });
  }
  return out;
}

export type OrgAccess =
  | { ok: true; org: Org; role: OrgRole | "admin-support"; member: Member | null }
  | { ok: false; status: number; message: string };

/**
 * Who may open an organisation's pages.
 *  - members: always (their role decides what they can change)
 *  - platform admins: only when the organisation has switched on support access (the NDA switch)
 */
export async function orgAccess(slug: string, login: string | null): Promise<OrgAccess> {
  const org = await orgBySlug(slug);
  if (!org) return { ok: false, status: 404, message: "Organisation not found." };
  if (!login) return { ok: false, status: 401, message: "Sign in to view this organisation." };
  const member = await membership(org.id, login);
  if (member && member.status !== "left") return { ok: true, org, role: member.role, member };
  if (isAdmin(login)) {
    if (org.supportAccess) return { ok: true, org, role: "admin-support", member: null };
    return { ok: false, status: 403, message: "This organisation has not granted support access, so platform admins cannot view its data." };
  }
  return { ok: false, status: 403, message: "You are not a member of this organisation." };
}

export function canManage(role: OrgRole | "admin-support"): boolean {
  return role === "owner" || role === "manager";
}

export async function audit(orgId: string | null, actor: string, action: string, target?: string, meta?: Record<string, unknown>): Promise<void> {
  const entry: AuditEntry = { id: newId("a_"), orgId, actor, action, target, at: new Date().toISOString(), meta };
  await put("audit", entry);
}
