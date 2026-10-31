import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/Mascot";
import { RepoList } from "@/components/RepoList";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import Loading from "./loading";
import { relativeTime } from "@/lib/format";
import { listRepos, recentAnalyses } from "@/lib/github";
import { getSession } from "@/lib/session";

export const metadata = { title: "Your repositories · Ghost-Architect" };

async function DashboardBody() {
  const session = await getSession();
  if (!session) redirect("/");
  const [repos, recent] = await Promise.all([listRepos(session.token), recentAnalyses()]);
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
            <Link href="/dashboard" className="rounded-md px-2 py-1 font-semibold">Repositories</Link>
            <Link href="/analyse" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Analyse any repo</Link>
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="stagger space-y-4">
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
              <p className="px-4 py-4 text-[12px] text-fg-muted">Nothing yet. Pick a repository and hit Analyse.</p>
            ) : (
              <ul className="divide-y divide-border-muted">
                {recent.map((r) => (
                  <li key={r.repoUrl}>
                    <Link href={`/r/${r.slug}`} className="block px-4 py-2 hover:bg-canvas-subtle">
                      <p className="truncate font-mono text-[12px] text-accent">{r.slug}</p>
                      <p className="text-[11px] text-fg-muted">{r.analysedFiles} files · {r.authors} authors · {relativeTime(r.analyzedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0">
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
