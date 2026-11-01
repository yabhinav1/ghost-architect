import { authorizeRepo } from "@/lib/access";
import { normalizeRepoUrl } from "@/lib/git";
import { reposOf } from "@/lib/org";
import { pendingWork } from "@/lib/pending";
import { rateLimit, tooMany } from "@/lib/ratelimit";
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
  const limit = rateLimit(request, "analyze", g.login);
  if (!limit.ok) return tooMany(limit, "pending-work lookups");
  let url: string;
  try {
    url = normalizeRepoUrl(repo);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  // Only repositories linked to this organisation, and only if the caller's own GitHub access allows reading them.
  if (!(await reposOf(g.access.org.id)).some((r) => r.repoUrl === url)) return Response.json({ error: "That repository is not linked to this organisation" }, { status: 404 });
  const session = await getSession();
  const access = await authorizeRepo(url);
  if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
  try {
    return Response.json(await pendingWork(url, login, m.email, session?.token || undefined));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
