import { acceptInvite } from "@/lib/org";
import { getSession } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  const r = await acceptInvite(token, { login: session.login, name: session.name, avatar: session.avatar });
  if ("error" in r) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ org: r.org, member: r.member });
}
