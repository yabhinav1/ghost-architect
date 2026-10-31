import { NOTICE_TEMPLATES, fillTemplate, noticesOf, sendNotice } from "@/lib/org";
import { membership } from "@/lib/roles";
import type { NoticeType } from "@/lib/types";
import { guard, json } from "../_guard";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  return Response.json({ notices: await noticesOf(g.access.org.id), templates: NOTICE_TEMPLATES });
}

/** Send a notice to a member. Subject and body may use {name} {org} {lastDay} {repo} {message} placeholders. */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const g = await guard(slug, true);
  if (!g.ok) return g.res;
  const body = await json<{ toLogin?: string; type?: NoticeType; subject?: string; body?: string; message?: string; repo?: string; handoverId?: string }>(request);
  if (!body?.toLogin) return Response.json({ error: "toLogin is required" }, { status: 400 });
  const to = await membership(g.access.org.id, body.toLogin);
  if (!to) return Response.json({ error: `@${body.toLogin} is not a member of this organisation` }, { status: 404 });
  const type: NoticeType = body.type && body.type in NOTICE_TEMPLATES ? body.type : "general";
  const tpl = NOTICE_TEMPLATES[type];
  const vars = { name: to.name || to.login, org: g.access.org.name, lastDay: to.lastDay ?? "(to be confirmed)", repo: body.repo ?? "the repository", message: body.message ?? "" };
  const subject = fillTemplate(body.subject?.trim() || tpl.subject, vars);
  const text = fillTemplate(body.body?.trim() || tpl.body, vars);
  if (!text.trim()) return Response.json({ error: "The notice has no body" }, { status: 400 });
  const n = await sendNotice(g.access.org, g.login, { toLogin: to.login, type, subject, body: text, handoverId: body.handoverId });
  return Response.json({ notice: n });
}
