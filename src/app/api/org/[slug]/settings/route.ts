import { list, put } from "@/lib/db";
import { audit } from "@/lib/roles";
import type { AuditEntry, Org } from "@/lib/types";
import { guard, json } from "../_guard";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const entries = (await list<AuditEntry>("audit", (a) => a.orgId === g.access.org.id)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  return Response.json({ org: g.access.org, audit: entries });
}

/** Owner-only: rename, or flip support access (the NDA switch that lets platform admins view this organisation). */
export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  if (g.access.role !== "owner") return Response.json({ error: "Only an owner can change organisation settings" }, { status: 403 });
  const body = await json<{ name?: string; supportAccess?: boolean; githubOrg?: string }>(request);
  const next: Org = { ...g.access.org };
  if (body?.name && body.name.trim().length >= 2) next.name = body.name.trim().slice(0, 80);
  if (typeof body?.supportAccess === "boolean" && body.supportAccess !== next.supportAccess) {
    next.supportAccess = body.supportAccess;
    next.supportAccessChangedAt = new Date().toISOString();
    next.supportAccessChangedBy = g.login;
    await audit(next.id, g.login, body.supportAccess ? "org.supportAccess.grant" : "org.supportAccess.revoke", next.slug);
  }
  if (body?.githubOrg !== undefined) next.githubOrg = body.githubOrg.trim().slice(0, 80) || undefined;
  await put("orgs", next);
  return Response.json({ org: next });
}
