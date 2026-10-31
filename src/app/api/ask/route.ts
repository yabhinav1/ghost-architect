import { z } from "zod";
import { gatherEvidence } from "@/lib/explain";
import { fileContent } from "@/lib/git";
import { chatJson, extractJson, LlmError } from "@/lib/llm";
import { authorizeRepo, denied } from "@/lib/access";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import type { AskResult } from "@/lib/types";

const AskSchema = z.object({
  answer: z.string(),
  evidence: z.array(z.string()).default([]),
  status: z.enum(["documented", "inferred", "not_documented"]),
});

const SYSTEM = `You are the ghost of the engineers who wrote this file. Answer the question using ONLY the evidence list (commits and pull requests) and the file content.

Rules:
- If the evidence answers the question, cite the evidence IDs (C1, P2, ...) and set status "documented".
- If only the code itself suggests an answer, say what you infer and from which lines, set status "inferred", evidence [].
- If neither explains it, say plainly that the reason is not documented and set status "not_documented". Never invent history.
- Three sentences maximum. Plain words.

Respond with ONLY a JSON object: {"answer": "...", "evidence": ["C1"], "status": "documented" | "inferred" | "not_documented"}`;

export async function POST(request: Request) {
  let body: { repoUrl?: string; file?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { repoUrl, file, question } = body;
  if (!repoUrl || !file || !question?.trim()) return Response.json({ error: "repoUrl, file and question are required" }, { status: 400 });
  if (file.includes("..") || file.startsWith("/")) return Response.json({ error: "Invalid file path" }, { status: 400 });
  const access = await authorizeRepo(repoUrl);
  if (!access.ok) return denied(access);
  const rl = rateLimit(request, "llm", Boolean(access.session));
  if (!rl.ok) return tooMany(rl, "questions");
  try {
    const [evidence, content] = await Promise.all([gatherEvidence(repoUrl, file, access.session?.token), fileContent(repoUrl, file, 260)]);
    const evidenceText = evidence.map((e) => `[${e.id}] ${e.kind.toUpperCase()} ${e.date.slice(0, 10)} by ${e.author}\n${e.title}\n${e.body}`.trim()).join("\n\n");
    const user = `File: ${file}\nQuestion: ${question.trim()}\n\n=== EVIDENCE ===\n${evidenceText || "(none)"}\n\n=== FILE CONTENT ===\n${content.text}`;
    const { text } = await chatJson([{ role: "system", content: SYSTEM }, { role: "user", content: user }], { maxTokens: 800 });
    const parsed = AskSchema.safeParse(extractJson(text));
    if (!parsed.success) throw new Error("LLM returned JSON in the wrong shape");
    const result: AskResult & { evidenceItems: typeof evidence } = { ...parsed.data, evidenceItems: evidence.filter((e) => parsed.data.evidence.includes(e.id)) };
    return Response.json(result);
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
