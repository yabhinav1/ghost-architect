import { authorizeRepo, denied } from "@/lib/access";
import { explainFile } from "@/lib/explain";
import { LlmError } from "@/lib/llm";
import { rateLimit, tooMany } from "@/lib/ratelimit";

export async function POST(request: Request) {
  let body: { repoUrl?: string; file?: string; departed?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.repoUrl || !body.file) return Response.json({ error: "repoUrl and file are required" }, { status: 400 });
  if (body.file.includes("..") || body.file.startsWith("/")) return Response.json({ error: "Invalid file path" }, { status: 400 });
  const access = await authorizeRepo(body.repoUrl);
  if (!access.ok) return denied(access);
  const rl = rateLimit(request, "llm", Boolean(access.session));
  if (!rl.ok) return tooMany(rl, "briefs");
  try {
    const result = await explainFile(body.repoUrl, body.file, body.departed ?? [], access.session?.token);
    return Response.json(result);
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
