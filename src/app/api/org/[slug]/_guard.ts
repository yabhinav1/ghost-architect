import { getSession } from "@/lib/session";
import { canManage, orgAccess, type OrgAccess } from "@/lib/roles";

export type Guarded = { ok: true; login: string; access: Extract<OrgAccess, { ok: true }> } | { ok: false; res: Response };

/** Session + organisation membership; `manage` additionally requires owner or manager. */
export async function guard(slug: string, manage = false): Promise<Guarded> {
  const session = await getSession();
  const access = await orgAccess(slug, session?.login ?? null);
  if (!access.ok) return { ok: false, res: Response.json({ error: access.message }, { status: access.status }) };
  if (manage && !canManage(access.role)) return { ok: false, res: Response.json({ error: "Only owners and managers can do this" }, { status: 403 }) };
  return { ok: true, login: session!.login, access };
}

export async function json<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
