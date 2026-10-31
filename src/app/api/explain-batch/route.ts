import { explainFile } from "@/lib/explain";
import { LlmError } from "@/lib/llm";
import { authorizeRepo, denied } from "@/lib/access";
import { rateLimit, tooMany } from "@/lib/ratelimit";

/** Runs the explainer over several files in sequence, streaming one NDJSON line per file. */
export async function POST(request: Request) {
  let body: { repoUrl?: string; files?: string[]; departed?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { repoUrl, files, departed = [] } = body;
  if (!repoUrl || !files?.length) return Response.json({ error: "repoUrl and files are required" }, { status: 400 });
  if (files.some((f) => f.includes("..") || f.startsWith("/"))) return Response.json({ error: "Invalid file path" }, { status: 400 });

  const access = await authorizeRepo(repoUrl);
  if (!access.ok) return denied(access);
  const session = access.session;
  const token = session?.token;
  const rl = rateLimit(request, "llm", Boolean(session), Math.min(files.length, 15));
  if (!rl.ok) return tooMany(rl, "briefs");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      for (const file of files.slice(0, 15)) {
        try {
          send({ file, result: await explainFile(repoUrl, file, departed, token) });
        } catch (e) {
          send({ file, error: e instanceof LlmError ? e.message : (e as Error).message });
          if (e instanceof LlmError && e.status === 401) break;
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
