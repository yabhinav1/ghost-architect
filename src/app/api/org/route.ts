import { createOrg } from "@/lib/org";
import { getSession } from "@/lib/session";

/** Create an organisation; the creator becomes its owner. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first" }, { status: 401 });
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (name.length < 2) return Response.json({ error: "Give the organisation a name" }, { status: 400 });
  const org = await createOrg(name, { login: session.login, name: session.name, avatar: session.avatar });
  return Response.json({ org });
}
