import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/roles";
import { appOrigin, seal, SESSION_COOKIE, sessionCookieOptions, type Session } from "@/lib/session";

/**
 * Developer sign-in without GitHub, for local demos only. Hard-disabled unless BOTH
 * NODE_ENV is "development" and DEV_LOGIN=1. Sessions carry no GitHub token, so only
 * public repositories can be analysed with them.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_LOGIN !== "1") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const login = (url.searchParams.get("login") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 39);
  if (!login) return Response.json({ error: "login is required" }, { status: 400 });
  const name = (url.searchParams.get("name") ?? login).trim().slice(0, 80) || login;
  const as = url.searchParams.get("as") ?? "user";
  const session: Session = { token: "", login, name, avatar: `https://avatars.githubusercontent.com/u/0?v=4&login=${login}` };
  const landing = as === "admin" ? (isAdmin(login) ? "/admin" : `/?error=${encodeURIComponent(`${login} is not in ADMIN_LOGINS`)}`) : as === "org" ? "/org" : "/dashboard";
  const res = NextResponse.redirect(`${appOrigin(request)}${landing}`);
  res.cookies.set(SESSION_COOKIE, seal(session), sessionCookieOptions());
  return res;
}
