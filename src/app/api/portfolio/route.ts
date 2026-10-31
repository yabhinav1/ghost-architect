import fs from "node:fs/promises";
import { cacheDir, normalizeRepoUrl, repoKey } from "@/lib/git";
import { portfolioSummary } from "@/lib/insights";
import { listRepos } from "@/lib/github";
import { getSession } from "@/lib/session";
import type { Analysis } from "@/lib/types";

/** Summaries for the signed-in user's repos that already have a cached analysis. Never clones; missing ones come back null. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to see your portfolio" }, { status: 401 });
  let body: { repos?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Only repos this account can see, as listed by their own token.
  const mine = new Set((await listRepos(session.token)).repos.map((r) => r.html_url.toLowerCase()));
  const repos = (body.repos ?? []).filter((r) => mine.has(String(r).toLowerCase().replace(/\/+$/, ""))).slice(0, 50);
  const out: Record<string, ReturnType<typeof portfolioSummary> | null> = {};
  await Promise.all(
    repos.map(async (r) => {
      try {
        const url = normalizeRepoUrl(r);
        const a = JSON.parse(await fs.readFile(cacheDir("analysis", repoKey(url) + ".json"), "utf8")) as Analysis;
        out[r] = portfolioSummary(a);
      } catch {
        out[r] = null;
      }
    }),
  );
  return Response.json(out);
}
