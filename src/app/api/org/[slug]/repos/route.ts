import { authorizeRepo } from "@/lib/access";
import { addRepo, removeRepo, reposOf } from "@/lib/org";
import { guard, json } from "../_guard";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug);
  if (!g.ok) return g.res;
  return Response.json({ repos: await reposOf(g.access.org.id) });
}

/** Link a repository the manager can read. Private repos are checked against the manager's own token. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const body = await json<{ repoUrl?: string }>(request);
  if (!body?.repoUrl) return Response.json({ error: "repoUrl is required" }, { status: 400 });
  const access = await authorizeRepo(body.repoUrl);
  if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
  try {
    return Response.json({ repo: await addRepo(g.access.org, body.repoUrl, g.login) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const repoUrl = new URL(request.url).searchParams.get("repo");
  if (!repoUrl) return Response.json({ error: "repo is required" }, { status: 400 });
  await removeRepo(g.access.org, repoUrl, g.login);
  return Response.json({ ok: true });
}
