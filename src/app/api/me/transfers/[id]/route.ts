import { getSession } from "@/lib/session";
import { changeTransfer, inviteTransferCollaborator, TransferError } from "@/lib/work-transfers";
import { rateLimit, tooMany } from "@/lib/ratelimit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (!["read", "accept", "decline", "cancel", "invite"].includes(action)) return Response.json({ error: "Invalid action." }, { status: 400 });
  const limit = rateLimit(request, "transfer", session.login);
  if (!limit.ok) return tooMany(limit, "handoff actions");
  try {
    const transfer = action === "invite" ? await inviteTransferCollaborator(session, id) : await changeTransfer(session, id, action);
    return Response.json({ transfer });
  } catch (e) {
    return Response.json({ error: e instanceof TransferError ? e.message : "Could not update this handoff. Please try again." }, { status: e instanceof TransferError ? e.status : 503 });
  }
}
