import fs from "node:fs/promises";
import { cacheDir, normalizeRepoUrl, repoKey } from "@/lib/git";
import { portfolioSummary } from "@/lib/insights";
import type { Analysis } from "@/lib/types";

/** Summaries for repos that already have a cached analysis. Never clones; missing ones come back null. */
export async function POST(request: Request) {
  let body: { repos?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const repos = (body.repos ?? []).slice(0, 50);
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
