import { createHandover, handoversOf, sendNotice, NOTICE_TEMPLATES, fillTemplate } from "@/lib/org";
import { stripQuiz } from "@/lib/quiz-client";
import { membership } from "@/lib/roles";
import { guard, json } from "../_guard";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug);
  if (!g.ok) return g.res;
  const all = await handoversOf(g.access.org.id);
  const manager = g.access.role === "owner" || g.access.role === "manager" || g.access.role === "admin-support";
  const me = g.login.toLowerCase();
  return Response.json({ handovers: (manager ? all : all.filter((h) => h.leaverLogin === me || h.receiverLogin === me)).map(stripQuiz) });
}

/** Create a handover from a leaver to a receiver for one repo; both get a notice. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const body = await json<{ repoUrl?: string; leaverLogin?: string; receiverLogin?: string; dueDate?: string; files?: string[]; notify?: boolean }>(request);
  if (!body?.repoUrl || !body.leaverLogin || !body.receiverLogin) return Response.json({ error: "repoUrl, leaverLogin and receiverLogin are required" }, { status: 400 });
  const [leaver, receiver] = await Promise.all([membership(g.access.org.id, body.leaverLogin), membership(g.access.org.id, body.receiverLogin)]);
  if (!leaver || !receiver) return Response.json({ error: "Both people must be members of this organisation" }, { status: 404 });
  if (leaver.login === receiver.login) return Response.json({ error: "Leaver and receiver must differ" }, { status: 400 });
  try {
    const h = await createHandover(g.access.org, g.login, { repoUrl: body.repoUrl, leaverLogin: leaver.login, receiverLogin: receiver.login, dueDate: body.dueDate, files: body.files });
    if (body.notify !== false) {
      const repo = h.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
      for (const m of [leaver, receiver]) {
        const vars = { name: m.name || m.login, org: g.access.org.name, repo, lastDay: leaver.lastDay ?? "(to be confirmed)", message: "" };
        await sendNotice(g.access.org, g.login, { toLogin: m.login, type: "handover", subject: fillTemplate(NOTICE_TEMPLATES.handover.subject, vars), body: fillTemplate(NOTICE_TEMPLATES.handover.body, vars), handoverId: h.id });
      }
    }
    return Response.json({ handover: stripQuiz(h) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
