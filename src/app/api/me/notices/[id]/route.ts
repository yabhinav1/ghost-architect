import { get, put } from "@/lib/db";
import { audit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import type { Notice } from "@/lib/types";

/** Mark a notice read or acknowledged. Only its recipient can. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const n = await get<Notice>("notices", id);
  if (!n || n.toLogin !== session.login.toLowerCase()) return Response.json({ error: "Notice not found" }, { status: 404 });
  let body: { action?: "read" | "acknowledge" } = {};
  try {
    body = await request.json();
  } catch {
    // default to read
  }
  const now = new Date().toISOString();
  const next: Notice = { ...n };
  if (!next.readAt) next.readAt = now;
  if (next.status === "sent") next.status = "read";
  if (body.action === "acknowledge") {
    next.ackAt = next.ackAt ?? now;
    next.status = "acknowledged";
    await audit(n.orgId, session.login, "notice.acknowledge", n.id, { type: n.type });
  }
  await put("notices", next);
  return Response.json({ notice: next });
}
