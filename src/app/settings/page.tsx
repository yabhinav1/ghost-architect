import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/Mascot";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { getAppConfig } from "@/lib/app-config";
import { getSession } from "@/lib/session";
import { storeEnabled } from "@/lib/store";
import { countSavedScenarios, getRecent } from "@/lib/userdata";

export const metadata = { title: "Settings" };

async function SettingsBody({ searchParams }: { searchParams: Promise<{ cleared?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { cleared } = await searchParams;
  const [scenarios, recent] = await Promise.all([countSavedScenarios(session.login), getRecent(session.login)]);
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const cfg = getAppConfig();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 flex items-center gap-1 text-[13px]">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Repositories</Link>
            <span className="rounded-md px-2 py-1 font-semibold">Settings</span>
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="mx-auto max-w-[900px] space-y-4 px-4 py-6">
        {cleared && <p className="rounded-md border border-success/40 bg-success-muted px-3 py-2 text-[13px]">Your saved scenarios and history on this server were deleted.</p>}

        <section className="card">
          <div className="card-header">Account</div>
          <div className="flex items-center gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatar} alt="" width={56} height={56} className="rounded-full border border-border" />
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-[13px] text-fg-muted">@{user.login} · signed in with GitHub{cfg?.kind === "github-app" ? " App" : ""}</p>
              <p className="mt-1 text-[12px] text-fg-subtle">Your token lives in an encrypted cookie on this browser only. Private repositories are cloned with it per request and never shared with other accounts.</p>
            </div>
            <a href="/api/auth/logout" className="btn ml-auto">Sign out</a>
          </div>
        </section>

        <section className="card">
          <div className="card-header">Your data on this server</div>
          <dl className="grid grid-cols-2 gap-px bg-border-muted sm:grid-cols-3">
            <div className="bg-canvas p-4"><dt className="text-[12px] text-fg-muted">Saved scenarios</dt><dd className="text-2xl font-semibold">{scenarios}</dd><dd className="text-[11px] text-fg-subtle">departed lists, leavers, KT ticks</dd></div>
            <div className="bg-canvas p-4"><dt className="text-[12px] text-fg-muted">Repositories in your history</dt><dd className="text-2xl font-semibold">{recent.length}</dd></div>
            <div className="bg-canvas p-4"><dt className="text-[12px] text-fg-muted">Durable storage</dt><dd className="text-2xl font-semibold">{storeEnabled ? "on" : "off"}</dd><dd className="text-[11px] text-fg-subtle">{storeEnabled ? "survives redeploys" : "this server's disk only"}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
            <p className="flex-1 text-[13px] text-fg-muted">Delete your scenarios and history. Shared analysis caches of public repositories are not affected.</p>
            <form action="/api/me/clear" method="post">
              <button type="submit" className="btn text-danger"><Octicon name="history" className="h-4 w-4" />Clear my data</button>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-header">How access works</div>
          <ul className="list-disc space-y-1 p-4 pl-8 text-[13px] text-fg-muted">
            <li>Public repositories can be analysed by anyone, signed in or not.</li>
            <li>A private repository is only served to accounts whose GitHub token can read it, on every endpoint, including share links and reports.</li>
            <li>Saved scenarios are yours alone. Two people analysing the same repo see the same code facts but their own departed lists.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ cleared?: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SettingsBody searchParams={searchParams} />
    </Suspense>
  );
}
