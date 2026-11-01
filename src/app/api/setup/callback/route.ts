import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/session";
import { getActiveAppConfig, saveAppConfig } from "@/lib/app-config";

/** GitHub redirects here after the one-click app creation; exchange the code for credentials. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/gh_setup_state=([^;]+)/)?.[1];
  // Only an operator may (re)configure sign-in: a working config is never replaced, and a broken one only with SETUP_TOKEN.
  const { config } = await getActiveAppConfig();
  const setupToken = process.env.SETUP_TOKEN?.trim();
  const cookieToken = decodeURIComponent(request.headers.get("cookie")?.match(/gh_setup_token=([^;]+)/)?.[1] ?? "");
  const envPairPresent = Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
  if (config || (envPairPresent && !(setupToken && cookieToken === setupToken))) {
    return NextResponse.redirect(`${appOrigin(request)}/?error=${encodeURIComponent("Sign-in is already configured on this server; only the operator can change it.")}`);
  }
  if (!code) return NextResponse.redirect(`${appOrigin(request)}/?error=${encodeURIComponent("GitHub did not return a setup code.")}`);
  if (!state || state !== cookieState) return NextResponse.redirect(`${appOrigin(request)}/?error=${encodeURIComponent("Setup state mismatch. Try again.")}`);

  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" },
  });
  if (!res.ok) return NextResponse.redirect(`${appOrigin(request)}/?error=${encodeURIComponent(`GitHub refused the app conversion (${res.status}).`)}`);
  const app = (await res.json()) as { client_id: string; client_secret: string; slug: string; name: string };
  saveAppConfig({ clientId: app.client_id, clientSecret: app.client_secret, slug: app.slug, name: app.name, kind: "github-app" });

  const out = NextResponse.redirect(`${appOrigin(request)}/api/auth/login`);
  out.cookies.set("gh_setup_state", "", { path: "/", maxAge: 0 });
  out.cookies.set("gh_setup_token", "", { path: "/", maxAge: 0 });
  return out;
}
