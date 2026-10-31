import { NextResponse } from "next/server";
import { saveAppConfig } from "@/lib/app-config";

/** GitHub redirects here after the one-click app creation; exchange the code for credentials. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/gh_setup_state=([^;]+)/)?.[1];
  if (!code) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent("GitHub did not return a setup code."), request.url));
  if (!state || state !== cookieState) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent("Setup state mismatch. Try again."), request.url));

  const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" },
  });
  if (!res.ok) return NextResponse.redirect(new URL("/?error=" + encodeURIComponent(`GitHub refused the app conversion (${res.status}).`), request.url));
  const app = (await res.json()) as { client_id: string; client_secret: string; slug: string; name: string };
  saveAppConfig({ clientId: app.client_id, clientSecret: app.client_secret, slug: app.slug, name: app.name, kind: "github-app" });

  const out = NextResponse.redirect(new URL("/api/auth/login", request.url));
  out.cookies.set("gh_setup_state", "", { path: "/", maxAge: 0 });
  return out;
}
