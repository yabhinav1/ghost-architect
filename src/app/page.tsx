import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeviceLogin } from "@/components/DeviceLogin";
import { Mascot } from "@/components/Mascot";
import { Octicon } from "@/components/ui";
import { getUser } from "@/lib/session";

async function LandingBody({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;
  const oauthConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

  return (
    <div className="hero-glow min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2 font-semibold"><Mascot size={28} /> Ghost-Architect</span>
        <nav className="flex items-center gap-2 text-[13px]">
          <Link href="/analyse" className="btn btn-sm btn-invisible">Try on a public repo</Link>
          <a href="https://github.com/yabhinav1/ghost-architect" target="_blank" className="btn btn-sm">Source</a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="stagger">
            <span className="label label-accent">Bus-factor radar</span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Find the code nobody understands anymore, <span className="text-accent">before it breaks.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] text-fg-muted">
              Connect your GitHub and Ghost-Architect reads every repository&rsquo;s history, scores the files whose authors have left, plans handovers for engineers on notice, and explains why old code exists from commit and pull-request evidence.
            </p>
            {error && <p className="mt-4 rounded-md border border-danger/40 bg-danger-muted px-3 py-2 text-[13px]">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {oauthConfigured ? (
                <a href="/api/auth/login" className="btn btn-primary !px-5 !py-2.5 !text-[15px]">Continue with GitHub</a>
              ) : (
                <DeviceLogin className="!px-5 !py-2.5 !text-[15px]" />
              )}
              <Link href="/analyse" className="btn !px-5 !py-2.5 !text-[15px]">Analyse a public repo</Link>
            </div>
            <p className="mt-3 text-[12px] text-fg-subtle">Read-only access to your repositories. Nothing is written back. Sign out anytime.</p>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-accent-emphasis/20 blur-3xl" />
              <Mascot size={300} float track />
            </div>
          </div>
        </section>

        <section className="stagger mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: "flame" as const, title: "Heatmap of orphaned code", body: "Every file scored by blame, recent commits, and how many files import it. Red means critical and nobody left who wrote it." },
            { icon: "people" as const, title: "Notice-period handovers", body: "One leaver in, a ranked handover plan out: receivers per file, a KT checklist, and a countdown to their last day." },
            { icon: "ghost" as const, title: "Ask the ghost", body: "Briefs and answers that cite commits and PRs. When history is silent, it says not documented instead of making something up." },
          ].map((f) => (
            <div key={f.title} className="card p-4">
              <Octicon name={f.icon} className="h-5 w-5 text-accent" />
              <p className="mt-2 font-semibold">{f.title}</p>
              <p className="mt-1 text-[13px] text-fg-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-6 text-[12px] text-fg-subtle">Built at hackCBS 2026. Blame shows who last edited a line, not who understood it; Ghost-Architect blends it with commit history and always shows its evidence.</footer>
    </div>
  );
}

export default function Landing({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LandingBody searchParams={searchParams} />
    </Suspense>
  );
}
