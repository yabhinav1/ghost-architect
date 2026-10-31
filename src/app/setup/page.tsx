import { MascotLoader } from "@/components/MascotLoader";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Mascot } from "@/components/Mascot";
import { getActiveAppConfig } from "@/lib/app-config";
import { randomState } from "@/lib/session";
import { SetupForm } from "./SetupForm";

const REASONS: Record<string, string> = {
  "secret-is-token": "The GITHUB_CLIENT_SECRET on this server is a personal access token, not an OAuth client secret, so GitHub rejects sign-in. Fix the variable on the host, or create a GitHub App now and sign in through it instead.",
  rejected: "GitHub rejects the client id and secret configured on this server. Regenerate the secret on the OAuth App page and update the host, or create a GitHub App now and sign in through it instead.",
};

async function SetupBody({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { config, problem } = await getActiveAppConfig();
  if (config) redirect("/api/auth/login");
  const { reason } = await searchParams;
  const why = REASONS[reason ?? problem ?? ""];
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  const state = randomState();
  const manifest = {
    name: "Ghost-Architect",
    url: origin,
    description: "Bus-factor radar for codebases that lost their authors.",
    redirect_url: `${origin}/api/setup/callback`,
    callback_urls: [`${origin}/api/auth/callback`],
    setup_url: `${origin}/dashboard`,
    public: true,
    request_oauth_on_install: true,
    default_permissions: { contents: "read", metadata: "read", pull_requests: "read", email_addresses: "read" },
    default_events: [],
  };

  return (
    <div className="hero-glow flex min-h-screen flex-col items-center justify-center px-6">
      <div className="card w-full max-w-lg p-6 text-center">
        <Mascot size={96} className="mx-auto" />
        <h1 className="mt-3 text-xl font-semibold">One-time setup</h1>
        {why && <p className="mt-3 rounded-md border border-attention/40 bg-attention-muted px-3 py-2 text-left text-[13px]">{why} <a href="/api/health" className="underline">Check /api/health</a>.</p>}
        <p className="mt-2 text-[14px] text-fg-muted">
          GitHub needs an app behind every &ldquo;Sign in with GitHub&rdquo; button. Click below and GitHub creates <b className="text-fg">Ghost-Architect</b> on your account with the right settings already filled in. Confirm once, and you&rsquo;re back here signed in.
        </p>
        <SetupForm manifest={JSON.stringify(manifest)} state={state} />
        <p className="mt-4 text-[12px] text-fg-subtle">
          Creates a GitHub App that can read repository contents, metadata and pull requests. Nothing is written back. The credentials are stored on this machine in <code>.cache/github-app.json</code> and <code>.env.local</code>.
        </p>
      </div>
    </div>
  );
}

export default function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  return (
    <Suspense fallback={<MascotLoader />}>
      <SetupBody searchParams={searchParams} />
    </Suspense>
  );
}
