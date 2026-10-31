import { NextResponse } from "next/server";
import { appOrigin, getSession } from "@/lib/session";
import { clearUser } from "@/lib/userdata";

/** Delete this account's saved scenarios and history on this server. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  await clearUser(session.login);
  return NextResponse.redirect(`${appOrigin(request)}/settings?cleared=1`, { status: 303 });
}
