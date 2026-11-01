import { get, put } from "@/lib/db";
import { audit, membership, canManage } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { stripQuiz } from "@/lib/quiz-client";
import type { Handover, HandoverFile } from "@/lib/types";

/** Leaver, receiver, or a manager updates files (notes, links, done) or completes the handover. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const h = await get<Handover>("handovers", id);
  if (!h) return Response.json({ error: "Handover not found" }, { status: 404 });
  const me = session.login.toLowerCase();
  const m = await membership(h.orgId, me);
  const allowed = h.leaverLogin === me || h.receiverLogin === me || (m && canManage(m.role));
  if (!allowed) return Response.json({ error: "Not your handover" }, { status: 403 });
  let body: { files?: Partial<HandoverFile>[]; addFile?: string; removeFile?: string; status?: "open" | "complete"; dueDate?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const next: Handover = { ...h, files: h.files.map((f) => ({ ...f })) };
  if (body.files) {
    for (const u of body.files) {
      const f = next.files.find((x) => x.path === u.path);
      if (!f) continue;
      if (typeof u.notes === "string") f.notes = u.notes.slice(0, 5000);
      if (Array.isArray(u.links)) f.links = u.links.map(String).filter((l) => /^https?:\/\//.test(l)).slice(0, 20);
      if (typeof u.done === "boolean") {
        f.done = u.done;
        f.doneAt = u.done ? new Date().toISOString() : undefined;
      }
    }
  }
  if (body.addFile && !next.files.some((f) => f.path === body.addFile)) next.files.push({ path: body.addFile.slice(0, 300), done: false, notes: "", links: [] });
  if (body.removeFile) next.files = next.files.filter((f) => f.path !== body.removeFile);
  if (body.dueDate !== undefined && m && canManage(m.role)) next.dueDate = body.dueDate || undefined;
  if (body.status === "complete") {
    next.status = "complete";
    next.completedAt = new Date().toISOString();
    await audit(h.orgId, session.login, "handover.complete", h.id);
  } else if (body.status === "open") {
    next.status = "open";
    next.completedAt = undefined;
  }
  await put("handovers", next);
  return Response.json({ handover: stripQuiz(next) });
}
