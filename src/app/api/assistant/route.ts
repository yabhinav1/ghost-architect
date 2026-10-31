import { assertRepoPath, fileContent, fileHistory, normalizeRepoUrl } from "@/lib/git";
import { chatStream, LlmError, type ChatMessage } from "@/lib/llm";
import { authorizeRepo, denied } from "@/lib/access";
import { rateLimit, tooMany } from "@/lib/ratelimit";

type Ctx = {
  mode?: "layoffs" | "notice";
  selectedFile?: string | null;
  departed?: string[];
  stats?: { files: number; authors: number; redCount: number; orphanPct: number };
  topFiles?: { path: string; score: number; orphanShare: number; commits12m: number; inbound: number }[];
  knownFiles?: string[];
};

const APP_KNOWLEDGE = `You are Casper, the Ghost-Architect mascot: a friendly ghost in a hard hat who knows this repository and this web app. You help people who just opened a repo and are not sure what they are looking at.

What the app does: it finds code whose authors have left ("orphaned" code) and explains why that code exists.

How the screen works:
- The heatmap: one tile per file, size = lines of code, colour = Orphaned Criticality Score (0 safe to 100 critical). Click a tile for details. Hover shows the factors.
- The score = orphan share x log(1 + commits in the last 12 months) x (1 + number of files that import it). Orphan share blends 60% of blame lines owned by departed authors with 40% of their share of commits in the last 24 months.
- Two modes in the top bar. "Notice period": one engineer is leaving; enter their git email and last day to get a ranked handover plan with a suggested receiver per file, a KT checklist, and "Generate briefs for the top 10". "Layoffs": many people left; paste emails, upload a CSV, or click "simulate: top 3" to pretend the top authors left.
- "Why does this code exist?" on a file writes a brief from commit and PR evidence. Claims are marked documented (with evidence IDs you can click) or inferred, and anything unexplained is listed under "reason not documented".
- "Ask the ghost" under a brief answers questions about that one file from its history.
- Time machine slider rescores the repo as of a past month. Knowledge absorption charts show how much of a departed person's code others have since touched.
- Buttons in the repo header: Share (copies a link that re-runs this view), CODEOWNERS (downloads a proposed owners file), Report (printable one-pager).
- "mark as still here" next to an author corrects a wrong departed guess and recolours the map live.

Rules:
- Be brief: two to five sentences, or a short list. Plain words. No fluff, no emoji.
- When asked what a file does or what some code means, use the FILE CONTENT and RECENT COMMITS provided. If a file was not provided, say you can open it if they click it or name the path.
- Never invent history. If the commits do not explain something, say it is not documented.
- When relevant, point to the exact button or panel to click next.`;

export async function POST(request: Request) {
  let body: { repoUrl?: string; messages?: ChatMessage[]; context?: Ctx };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { repoUrl, messages = [], context = {} } = body;
  if (!repoUrl || !messages.length) return Response.json({ error: "repoUrl and messages are required" }, { status: 400 });
  let url: string;
  try {
    url = normalizeRepoUrl(repoUrl);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const access = await authorizeRepo(url);
  if (!access.ok) return denied(access);
  const rl = rateLimit(request, "llm", access.session?.login ?? null);
  if (!rl.ok) return tooMany(rl, "assistant questions");

  // Which files to open: the selected one, plus any known path the user mentions in their last message.
  const last = messages[messages.length - 1]?.content ?? "";
  const known = new Set(context.knownFiles ?? []);
  const mentioned = [...known].filter((p) => last.includes(p) || last.includes(p.split("/").pop() ?? "\u0000")).slice(0, 2);
  const wanted = [...new Set([context.selectedFile, ...mentioned].filter((p): p is string => Boolean(p)))]
    .filter((p) => {
      try {
        assertRepoPath(p);
        return true;
      } catch {
        return false; // traversal or absolute paths are silently dropped; the model is told nothing was loaded
      }
    })
    .slice(0, 2);

  const fileBlocks: string[] = [];
  for (const f of wanted) {
    try {
      const [c, h] = await Promise.all([fileContent(url, f, 160), fileHistory(url, f, 8)]);
      const top = context.topFiles?.find((t) => t.path === f);
      fileBlocks.push(
        `=== FILE: ${f}${top ? ` (score ${top.score}, orphan share ${Math.round(top.orphanShare * 100)}%, ${top.commits12m} commits in 12m, imported by ${top.inbound})` : ""} ===\n` +
          `RECENT COMMITS:\n${h.map((x) => `- ${x.date.slice(0, 10)} ${x.name}: ${x.subject}`).join("\n") || "(none in window)"}\n` +
          `CONTENT${c.truncated ? ` (first 160 of ${c.totalLines} lines)` : ""}:\n${c.text}`,
      );
    } catch {
      fileBlocks.push(`=== FILE: ${f} === (could not be read)`);
    }
  }

  const ctxText = [
    `Repository: ${url}`,
    context.mode ? `Mode: ${context.mode === "notice" ? "Notice period" : "Layoffs"}` : "",
    context.stats ? `Analysed ${context.stats.files} files by ${context.stats.authors} authors. ${context.stats.redCount} high-risk files. ${context.stats.orphanPct}% of lines last touched by departed authors.` : "",
    context.departed?.length ? `Departed: ${context.departed.join(", ")}` : "Nobody marked as departed yet, so every score is 0 until someone is.",
    context.selectedFile ? `The user currently has ${context.selectedFile} open in the side panel.` : "No file is selected.",
    context.topFiles?.length ? `Riskiest files right now:\n${context.topFiles.slice(0, 8).map((t) => `- ${t.path} (score ${t.score})`).join("\n")}` : "",
    ...fileBlocks,
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = `${APP_KNOWLEDGE}\n\n=== CURRENT CONTEXT ===\n${ctxText}`;
  const history = messages.slice(-8).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })) as ChatMessage[];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const piece of chatStream([{ role: "system", content: system }, ...history])) controller.enqueue(encoder.encode(piece));
      } catch (e) {
        const msg = e instanceof LlmError ? e.message : (e as Error).message;
        controller.enqueue(encoder.encode(`\n\n[Casper hit a snag: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
