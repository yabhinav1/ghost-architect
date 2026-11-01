import { get } from "@/lib/db";
import { buildPacket, packetAccess, packetMarkdown } from "@/lib/packet";
import { getSession } from "@/lib/session";
import type { Handover } from "@/lib/types";

/** The day-one packet as JSON, or `?format=md` as a downloadable Markdown file. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const h = await get<Handover>("handovers", id);
  if (!h) return Response.json({ error: "Handover not found" }, { status: 404 });
  if (!(await packetAccess(h, session.login))) return Response.json({ error: "Not your handover" }, { status: 403 });
  const url = new URL(request.url);
  const packet = await buildPacket(h, { token: session.token, withPending: url.searchParams.get("pending") !== "0" });
  if (url.searchParams.get("format") === "md") {
    const slug = h.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/[^\w.-]+/g, "-");
    return new Response(packetMarkdown(packet), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="day-one-${slug}.md"` } });
  }
  return Response.json(packet);
}
