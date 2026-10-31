import { getSession } from "@/lib/session";
import { inboxSummary } from "@/lib/inbox";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    return Response.json(await inboxSummary(session), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Your inbox could not be loaded. Please try again." }, { status: 503 });
  }
}
