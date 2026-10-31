import { authorizeRepo, denied } from "@/lib/access";
import { analyzeRepo, normalizeRepoUrl } from "@/lib/git";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { addRecent } from "@/lib/userdata";
import type { Progress } from "@/lib/types";

/**
 * Streams newline-delimited JSON: {"progress": {...}} lines while working,
 * then one {"result": Analysis} or {"error": string} line.
 */
export async function POST(request: Request) {
  let body: { repoUrl?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.repoUrl) return Response.json({ error: "repoUrl is required" }, { status: 400 });
  try {
    normalizeRepoUrl(body.repoUrl);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const repoUrl = body.repoUrl;
  const force = Boolean(body.force);
  const access = await authorizeRepo(repoUrl);
  if (!access.ok) return denied(access);
  const session = access.session;
  const rl = rateLimit(request, "analyze", Boolean(session));
  if (!rl.ok) return tooMany(rl, "analyses");
  const token = session?.token;
  const login = session?.login;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await analyzeRepo(repoUrl, force, (p: Progress) => send({ progress: p }), token);
        if (login) await addRecent(login, repoUrl).catch(() => undefined);
        send({ result });
      } catch (e) {
        console.error(e);
        send({ error: `Analysis failed: ${(e as Error).message}` });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
