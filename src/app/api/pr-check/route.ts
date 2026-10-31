import { normalizeRepoUrl } from "@/lib/git";
import { ghHeaders } from "@/lib/github";
import { authorizeRepo, denied } from "@/lib/access";

export type PrFile = { path: string; status: string; additions: number; deletions: number };
export type PrInfo = { number: number; title: string; author: string; state: string; url: string; files: PrFile[]; truncated: boolean };

/** Which files a pull request touches, from the GitHub API. Accepts a PR number or a PR URL. */
export async function POST(request: Request) {
  let body: { repoUrl?: string; pr?: string | number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { repoUrl, pr } = body;
  if (!repoUrl || pr === undefined || pr === "") return Response.json({ error: "repoUrl and pr are required" }, { status: 400 });
  let url: string;
  try {
    url = normalizeRepoUrl(repoUrl);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const gh = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
  if (!gh) return Response.json({ error: "PR check works for GitHub repositories only" }, { status: 400 });
  const n = Number(String(pr).match(/\/pull\/(\d+)/)?.[1] ?? String(pr).replace(/^#/, ""));
  if (!Number.isInteger(n) || n <= 0) return Response.json({ error: "Enter a PR number like 42 or paste the PR link" }, { status: 400 });

  const access = await authorizeRepo(url);
  if (!access.ok) return denied(access);
  const token = access.session?.token;
  const headers = ghHeaders(token);
  const meta = await fetch(`https://api.github.com/repos/${gh[1]}/${gh[2]}/pulls/${n}`, { headers });
  if (meta.status === 404) return Response.json({ error: `PR #${n} was not found${token ? "" : ". Sign in if the repo is private"}.` }, { status: 404 });
  if (meta.status === 403 || meta.status === 429) return Response.json({ error: "GitHub is rate-limiting this server. Sign in with GitHub or try again in a few minutes." }, { status: 429 });
  if (!meta.ok) return Response.json({ error: `GitHub returned ${meta.status}` }, { status: 502 });
  const m = (await meta.json()) as { title: string; user?: { login: string }; state: string; merged: boolean; html_url: string };

  const files: PrFile[] = [];
  let truncated = false;
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://api.github.com/repos/${gh[1]}/${gh[2]}/pulls/${n}/files?per_page=100&page=${page}`, { headers });
    if (!res.ok) break;
    const batch = (await res.json()) as { filename: string; status: string; additions: number; deletions: number }[];
    files.push(...batch.map((f) => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })));
    if (batch.length < 100) break;
    if (page === 3) truncated = true;
  }
  const info: PrInfo = { number: n, title: m.title, author: m.user?.login ?? "", state: m.merged ? "merged" : m.state, url: m.html_url, files, truncated };
  return Response.json(info);
}
