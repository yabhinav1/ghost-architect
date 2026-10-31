import { redirect } from "next/navigation";
import { orgAccess } from "@/lib/roles";
import { getSession } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

/** Shared page guard: redirects anonymous users to the organisation sign-in, 403/404 render a message. */
export async function requireOrg(slug: string) {
  const session = await getSession();
  if (!session) redirect("/api/auth/login?as=org");
  const access = await orgAccess(slug, session.login);
  const user: SessionUser = { login: session.login, name: session.name, avatar: session.avatar };
  return { session, user, access };
}
