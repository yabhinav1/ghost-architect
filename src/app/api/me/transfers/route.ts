import { getSession } from "@/lib/session";
import { createTransfer, TransferError } from "@/lib/work-transfers";
import { rateLimit, tooMany } from "@/lib/ratelimit";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  const limit = rateLimit(request, "transfer", session.login);
  if (!limit.ok) return tooMany(limit, "handoffs");
  const body = await request.json().catch(() => null);
  try {
    const transfer = await createTransfer(session, body);
    return Response.json({ transfer: { ...transfer, sealedGrant: undefined } }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof TransferError ? e.message : "Could not send this handoff. Check the repository URL and try again." }, { status: e instanceof TransferError ? e.status : 503 });
  }
}
