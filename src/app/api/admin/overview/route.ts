import fs from "node:fs/promises";
import { list } from "@/lib/db";
import { cacheDir } from "@/lib/git";
import { laneSummary } from "@/lib/llm";
import { isAdmin } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { storeEnabled } from "@/lib/store";
import type { AuditEntry, Handover, Member, Notice, Org, OrgRepo } from "@/lib/types";

/** Platform metrics for admins. Organisation contents are never included here; only counts and the NDA switch state. */
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session.login)) return Response.json({ error: "Admins only" }, { status: 403 });
  const [orgs, members, repos, notices, handovers, audit] = await Promise.all([list<Org>("orgs"), list<Member>("members"), list<OrgRepo>("orgRepos"), list<Notice>("notices"), list<Handover>("handovers"), list<AuditEntry>("audit")]);
  let analyses = 0;
  try {
    analyses = (await fs.readdir(cacheDir("analysis"))).filter((n) => n.endsWith(".json")).length;
  } catch {
    // none yet
  }
  return Response.json({
    counts: { orgs: orgs.length, members: members.length, uniqueUsers: new Set(members.map((m) => m.login)).size, repos: repos.length, analyses, notices: notices.length, handovers: handovers.length, openHandovers: handovers.filter((h) => h.status === "open").length },
    orgs: orgs.map((o) => ({ id: o.id, slug: o.slug, name: o.name, createdAt: o.createdAt, createdBy: o.createdBy, supportAccess: o.supportAccess, members: members.filter((m) => m.orgId === o.id).length, repos: repos.filter((r) => r.orgId === o.id).length })),
    lanes: laneSummary(),
    durableStore: storeEnabled,
    platformAudit: audit.filter((a) => a.orgId === null || a.action.startsWith("org.supportAccess") || a.action === "org.create").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100),
  });
}
