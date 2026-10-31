import { NextResponse } from "next/server";
import { getActiveAppConfig } from "@/lib/app-config";
import { appOrigin, randomState, sessionCookieOptions, STATE_COOKIE } from "@/lib/session";

const ROLES = new Set(["user", "org", "admin"]);

export async function GET(request: Request) {
  const as = new URL(request.url).searchParams.get("as") ?? "user";
  const { config: cfg, problem } = await getActiveAppConfig();
  // No usable credentials (fresh machine, or the host's secret is wrong): create a GitHub App with one click, then come back here.
  if (!cfg) return NextResponse.redirect(`${appOrigin(request)}/setup${problem ? `?reason=${problem}` : ""}`);
  const origin = appOrigin(request);
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
  res.cookies.set("gh_login_as", ROLES.has(as) ? as : "user", sessionCookieOptions(600));
  return res;
}
