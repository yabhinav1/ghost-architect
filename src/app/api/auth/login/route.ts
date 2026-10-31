import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import { randomState, sessionCookieOptions, STATE_COOKIE } from "@/lib/session";

export async function GET(request: Request) {
  const cfg = getAppConfig();
  // First run on a fresh machine: create the GitHub App with one click, then come back here.
  if (!cfg) return NextResponse.redirect(new URL("/setup", request.url));
  const origin = new URL(request.url).origin;
  const state = randomState();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: `${origin}/api/auth/callback`,
    scope: "repo read:user",
    state,
    allow_signup: "true",
  });
  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  res.cookies.set(STATE_COOKIE, state, sessionCookieOptions(600));
  return res;
}
