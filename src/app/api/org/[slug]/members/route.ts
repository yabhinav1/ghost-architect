import { del, get, put } from "@/lib/db";
import { createInvite } from "@/lib/org";
import { audit, membersOf } from "@/lib/roles";
import { appOrigin } from "@/lib/session";
import type { Member, OrgRole } from "@/lib/types";
import { guard, json } from "../_guard";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug);
  if (!g.ok) return g.res;
  return Response.json({ members: await membersOf(g.access.org.id) });
}

/** Invite: returns a link. With `login` the link only works for that GitHub account. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const body = await json<{ login?: string; role?: OrgRole }>(request);
  const role: OrgRole = body?.role === "manager" || body?.role === "owner" ? body.role : "member";
  if (role === "owner" && g.access.role !== "owner") return Response.json({ error: "Only an owner can invite another owner" }, { status: 403 });
  const inv = await createInvite(g.access.org, g.login, role, body?.login);
  return Response.json({ invite: inv, link: `${appOrigin(request)}/invite/${inv.id}` });
}

/** Edit a member: role, status, git email, last day. */
export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug);
  if (!g.ok) return g.res;
  const body = await json<{ login?: string; role?: OrgRole; status?: Member["status"]; email?: string; lastDay?: string; name?: string }>(request);
  if (!body?.login) return Response.json({ error: "login is required" }, { status: 400 });
  const id = `${g.access.org.id}:${body.login.toLowerCase()}`;
  const m = await get<Member>("members", id);
  if (!m) return Response.json({ error: "Not a member" }, { status: 404 });
  const self = m.login === g.login.toLowerCase();
  const manager = g.access.role === "owner" || g.access.role === "manager";
  if (!manager && !self) return Response.json({ error: "You can only edit your own details" }, { status: 403 });
  if (m.role === "owner" && !self && g.access.role !== "owner") return Response.json({ error: "Only an owner can edit an owner" }, { status: 403 });
  const next: Member = { ...m };
  if (body.email !== undefined) next.email = body.email.trim().toLowerCase().slice(0, 200) || undefined;
  if (body.name !== undefined && body.name.trim()) next.name = body.name.trim().slice(0, 120);
  if (manager) {
    if (body.role && ["owner", "manager", "member"].includes(body.role)) {
      if ((body.role === "owner" || m.role === "owner") && g.access.role !== "owner") return Response.json({ error: "Only an owner can change owner roles" }, { status: 403 });
      next.role = body.role;
    }
    if (body.status && ["active", "leaving", "left"].includes(body.status)) next.status = body.status;
    if (body.lastDay !== undefined) next.lastDay = body.lastDay.slice(0, 20) || undefined;
  }
  await put("members", next);
  await audit(g.access.org.id, g.login, "member.update", next.login, { role: next.role, status: next.status, lastDay: next.lastDay, emailSet: Boolean(next.email) });
  return Response.json({ member: next });
}

export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const login = new URL(request.url).searchParams.get("login")?.toLowerCase();
  if (!login) return Response.json({ error: "login is required" }, { status: 400 });
  if (login === g.login.toLowerCase()) return Response.json({ error: "Remove yourself from the settings page instead" }, { status: 400 });
  const m = await get<Member>("members", `${g.access.org.id}:${login}`);
  if (m?.role === "owner" && g.access.role !== "owner") return Response.json({ error: "Only an owner can remove an owner" }, { status: 403 });
  await del("members", `${g.access.org.id}:${login}`);
  await audit(g.access.org.id, g.login, "member.remove", login);
  return Response.json({ ok: true });
}
