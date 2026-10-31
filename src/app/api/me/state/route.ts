import { authorizeRepo, denied } from "@/lib/access";
import { getSession } from "@/lib/session";
import { getRepoState, setRepoState } from "@/lib/userdata";
import type { RepoState } from "@/lib/types";

/** The signed-in user's saved scenario for one repo. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to save scenarios" }, { status: 401 });
  const repo = new URL(request.url).searchParams.get("repo");
  if (!repo) return Response.json({ error: "repo is required" }, { status: 400 });
  try {
    return Response.json({ state: await getRepoState(session.login, repo) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to save scenarios" }, { status: 401 });
  let body: { repo?: string; state?: Partial<RepoState> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.repo || !body.state) return Response.json({ error: "repo and state are required" }, { status: 400 });
  const access = await authorizeRepo(body.repo);
  if (!access.ok) return denied(access);
  try {
    return Response.json({ state: await setRepoState(session.login, body.repo, body.state) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
