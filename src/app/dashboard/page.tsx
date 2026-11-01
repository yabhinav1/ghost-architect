import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Mascot";
import { Portfolio } from "@/components/Portfolio";
import { RepoList } from "@/components/RepoList";
import { RepoSearch } from "@/components/RepoSearch";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { InboxBox } from "@/components/InboxFeed";
import Loading from "./loading";
import { relativeTime } from "@/lib/format";
import { getAppConfig } from "@/lib/app-config";
import { listRepos } from "@/lib/github";
import { recentForUser } from "@/lib/userdata";
import { handoversFor, inboxOf } from "@/lib/org";
import { isAdmin } from "@/lib/roles";
import { getSession } from "@/lib/session";
import type { Repo } from "@/lib/types";

export const metadata = { title: "Your repositories · Ghost-Architect" };

async function DashboardBody() {
  const session = await getSession();
  if (!session) redirect("/");
  const [listing, recent, inbox, myHandovers] = await Promise.all([session.token ? listRepos(session.token) : Promise.resolve({ repos: [] as Repo[], installations: 0, fetchedAt: new Date().toISOString() }), recentForUser(session.login), inboxOf(session.login), handoversFor(session.login)]);
  const unread = inbox.filter((n) => n.status === "sent").length;
  const openHandovers = myHandovers.filter((h) => h.status === "open");

  const repos = listing.repos;
  const staleBefore = new Date(listing.fetchedAt ?? new Date().toISOString()).getTime() - 6 * 30.44 * 86400000; // server component: computed per request
  const stale = repos.filter((r) => !r.fork && !r.archived && Date.parse(r.pushed_at) < staleBefore).length;
  const cfg = getAppConfig();
  const installUrl = cfg?.kind === "github-app" && cfg.slug ? `https://github.com/apps/${cfg.slug}/installations/new` : null;
  const needsInstall = Boolean(installUrl) && listing.installations === 0;
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const privateCount = repos.filter((r) => r.private).length;
  const languages = Object.entries(
    repos.reduce<Record<string, number>>((acc, r) => { if (r.language) acc[r.language] = (acc[r.language] ?? 0) + 1; return acc; }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 font-semibold">My repositories</Link>
            <Link href="/org" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Organisations</Link>
            <Link href="/me" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Inbox{unread ? <span className="counter ml-1">{unread}</span> : null}</Link>
            <Link href="/analyse" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Analyse any repo</Link>
            {isAdmin(session.login) && <Link href="/admin" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Admin</Link>}
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} admin={isAdmin(session.login)} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-5 px-4 py-5 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside className="stagger space-y-4 lg:sticky lg:top-[57px] lg:max-h-[calc(100vh-57px-1.25rem)] lg:overflow-hidden">
          <InboxBox />
          <div className="card p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.avatar} alt="" width={64} height={64} className="rounded-full border border-border" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold leading-tight">{user.name}</p>
                <p className="truncate text-fg-muted">@{user.login}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border-muted bg-canvas-subtle p-2"><dt className="text-[11px] text-fg-muted">Repos</dt><dd className="text-lg font-semibold">{repos.length}</dd></div>
              <div className="rounded-md border border-border-muted bg-canvas-subtle p-2"><dt className="text-[11px] text-fg-muted">Private</dt><dd className="text-lg font-semibold">{privateCount}</dd></div>
              <div className="rounded-md border border-border-muted bg-canvas-subtle p-2"><dt className="text-[11px] text-fg-muted">Analysed</dt><dd className="text-lg font-semibold">{recent.length}</dd></div>
            </dl>
            {languages.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-semibold text-fg-muted">Languages</p>
                <ul className="space-y-1 text-[12px]">
                  {languages.map(([lang, n]) => (
                    <li key={lang} className="flex items-center justify-between"><span>{lang}</span><span className="counter">{n}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><Octicon name="history" className="h-4 w-4 text-fg-muted" />Recently analysed</div>
            {recent.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-fg-muted">Nothing yet. Pick a repository and hit Analyse. Your history is private to your account.</p>
            ) : (
              <ul className="divide-y divide-border-muted">
                {recent.map((r) => (
                  <li key={r.repoUrl}>
                    <Link href={`/r/${r.slug}`} className="block px-4 py-2 hover:bg-canvas-subtle">
                      <p className="truncate font-mono text-[12px] text-accent">{r.slug}</p>
                      <p className="text-[11px] text-fg-muted">{r.analysedFiles ? `${r.analysedFiles} files · ${r.authors} authors · ` : ""}{relativeTime(r.analyzedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {installUrl && (
            <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-[13px] ${needsInstall ? "border-attention/40 bg-attention-muted" : "border-border bg-canvas-subtle"}`}>
              <Octicon name="repo" className={`h-4 w-4 ${needsInstall ? "text-attention" : "text-fg-muted"}`} />
              <span className="flex-1">
                {needsInstall
                  ? "Private repositories show up once Ghost-Architect is installed on them. Takes one click, pick \u201cAll repositories\u201d."
                  : `Installed on ${listing.installations} account${listing.installations > 1 ? "s" : ""}. Add more repositories any time.`}
              </span>
              <a href={installUrl} className={`btn btn-sm ${needsInstall ? "btn-primary" : ""}`}>{needsInstall ? "Install on my repositories" : "Manage access"}</a>
            </div>
          )}
          <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Link href="/me" className="card p-3 hover:border-fg-subtle"><p className="text-[11px] text-fg-muted">Unread notices</p><p className={`text-2xl font-semibold ${unread ? "text-accent" : ""}`}>{unread}</p></Link>
            <Link href="/me" className="card p-3 hover:border-fg-subtle"><p className="text-[11px] text-fg-muted">Open handovers</p><p className={`text-2xl font-semibold ${openHandovers.length ? "text-attention" : ""}`}>{openHandovers.length}</p>{openHandovers[0]?.dueDate && <p className="text-[10px] text-fg-subtle">next due {openHandovers.map((h) => h.dueDate).filter(Boolean).sort()[0]}</p>}</Link>
            <div className="card p-3"><p className="text-[11px] text-fg-muted">Private / public</p><p className="text-2xl font-semibold">{privateCount} <span className="text-fg-muted">/ {repos.length - privateCount}</span></p></div>
            <div className="card p-3"><p className="text-[11px] text-fg-muted">Stale (6+ months)</p><p className={`text-2xl font-semibold ${stale ? "text-attention" : ""}`}>{stale}</p></div>
          </section>
          <div className="mb-4"><RepoSearch repos={repos} /></div>
          <Portfolio repos={repos.filter((r) => r.owner.login === user.login)} />
          <RepoList repos={repos} />
        </section>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardBody  />
    </Suspense>
  );
}
