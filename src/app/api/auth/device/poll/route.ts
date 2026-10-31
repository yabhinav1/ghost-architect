import { NextResponse } from "next/server";
import { pollDeviceFlow } from "@/lib/device-auth";
import { seal, SESSION_COOKIE, sessionCookieOptions, unseal, type Session } from "@/lib/session";

export async function POST(request: Request) {
  let body: { handle?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "Invalid body" }, { status: 400 });
  }
  const h = body.handle ? unseal<{ dc: string; exp: number }>(body.handle) : null;
  if (!h) return Response.json({ status: "error", message: "Invalid login handle" }, { status: 400 });
  if (Date.now() > h.exp) return Response.json({ status: "error", message: "The code expired. Start again." });

  const r = await pollDeviceFlow(h.dc);
  if (r.status !== "ok") return Response.json(r);

  const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${r.token}`, Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" } });
  if (!userRes.ok) return Response.json({ status: "error", message: "Could not read your GitHub profile." });
  const u = (await userRes.json()) as { login: string; name: string | null; avatar_url: string };
  const session: Session = { token: r.token, login: u.login, name: u.name ?? u.login, avatar: u.avatar_url };
  const res = NextResponse.json({ status: "ok", login: u.login });
  res.cookies.set(SESSION_COOKIE, seal(session), sessionCookieOptions());
  return res;
}
