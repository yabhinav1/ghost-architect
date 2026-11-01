import { pendingWork } from "@/lib/pending";
import { membership } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { guard } from "../_guard";

/** Work in flight for one member in one linked repo: open PRs, assigned issues, unmerged branches, their TODOs. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guard(slug);
  if (!g.ok) return g.res;
  const u = new URL(request.url);
  const login = u.searchParams.get("login")?.toLowerCase();
  const repo = u.searchParams.get("repo");
  if (!login || !repo) return Response.json({ error: "login and repo are required" }, { status: 400 });
  const manager = g.access.role === "owner" || g.access.role === "manager" || g.access.role === "admin-support";
  if (!manager && login !== g.login.toLowerCase()) return Response.json({ error: "You can only see your own pending work" }, { status: 403 });
  const m = await membership(g.access.org.id, login);
  if (!m) return Response.json({ error: "Not a member" }, { status: 404 });
  try {
    return Response.json(await pendingWork(repo, login, m.email, (await getSession())?.token || undefined));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
