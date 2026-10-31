import { NextResponse } from "next/server";
import { getActiveAppConfig } from "@/lib/app-config";
import { appOrigin, seal, SESSION_COOKIE, sessionCookieOptions, STATE_COOKIE, type Session } from "@/lib/session";

function fail(request: Request, msg: string) {
  const res = NextResponse.redirect(`${appOrigin(request)}/?error=${encodeURIComponent(msg)}`);
  res.cookies.set(STATE_COOKIE, "", { ...sessionCookieOptions(0) });
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !cookieState || state !== cookieState) return fail(request, "Login state mismatch. Try again.");

  const { config: cfg } = await getActiveAppConfig();
  if (!cfg) return fail(request, "GitHub app is not configured.");
  const { clientId, clientSecret } = cfg;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${appOrigin(request)}/api/auth/callback` }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!tokenJson.access_token) {
    const why = tokenJson.error_description ?? "GitHub did not return a token.";
    const hint = /client_id|client_secret/i.test(why) ? " The server's GitHub app credentials are wrong: open /api/health to see which variable to fix." : "";
    return fail(request, why + hint);
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" },
  });
  if (!userRes.ok) return fail(request, "Could not read your GitHub profile.");
  const u = (await userRes.json()) as { login: string; name: string | null; avatar_url: string };

  const session: Session = { token: tokenJson.access_token, login: u.login, name: u.name ?? u.login, avatar: u.avatar_url, expiresAt: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 - 60_000 : undefined };
  const res = NextResponse.redirect(`${appOrigin(request)}/dashboard`);
  res.cookies.set(SESSION_COOKIE, seal(session), sessionCookieOptions());
  res.cookies.set(STATE_COOKIE, "", { ...sessionCookieOptions(0) });
  return res;
}
