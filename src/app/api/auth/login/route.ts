import { NextResponse } from "next/server";
import { randomState, sessionCookieOptions, STATE_COOKIE } from "@/lib/session";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?error=" + encodeURIComponent("GITHUB_CLIENT_ID is not set. Create an OAuth app and add it to .env.local."), request.url));
  }
  const origin = new URL(request.url).origin;
  const state = randomState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback`,
    scope: "repo read:user",
    state,
    allow_signup: "true",
  });
  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  res.cookies.set(STATE_COOKIE, state, sessionCookieOptions(600));
  return res;
}
