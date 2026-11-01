import { MascotLoader } from "@/components/MascotLoader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/Mascot";
import { ThemePicker } from "@/components/ThemePicker";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { getAppConfig } from "@/lib/app-config";
import { isAdmin, orgsOf } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { storeEnabled } from "@/lib/store";
import { countSavedScenarios, getRecent } from "@/lib/userdata";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: "people" },
  { id: "appearance", label: "Appearance", icon: "ghost" },
  { id: "organisations", label: "Organisations", icon: "repo" },
  { id: "data", label: "Data and privacy", icon: "history" },
  { id: "access", label: "Access", icon: "check" },
] as const;

/** GitHub-style settings: a left navigation of sections and one card per section. */
async function SettingsBody({ searchParams }: { searchParams: Promise<{ cleared?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { cleared } = await searchParams;
  const [scenarios, recent, orgs] = await Promise.all([countSavedScenarios(session.login), getRecent(session.login), orgsOf(session.login)]);
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const cfg = getAppConfig();
  const admin = isAdmin(session.login);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">My repositories</Link>
            <Link href="/org" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Organisations</Link>
            <Link href="/me" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Inbox</Link>
            {admin && <Link href="/admin" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Admin</Link>}
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} admin={admin} />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={user.avatar} alt="" width={40} height={40} className="rounded-full border border-border" />
          <div><p className="text-[15px] font-semibold leading-tight">{user.name} <span className="font-normal text-fg-muted">@{user.login}</span></p><p className="text-[12px] text-fg-muted">Your personal account</p></div>
        </div>
        {cleared && <p className="mb-4 rounded-md border border-success/40 bg-success-muted px-3 py-2 text-[13px]">Your saved scenarios and history on this server were deleted.</p>}

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="lg:sticky lg:top-[70px] lg:self-start">
            <ul className="flex gap-1 overflow-x-auto text-[13px] lg:flex-col">
              {SECTIONS.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-fg hover:bg-canvas-subtle"><Octicon name={s.icon} className="h-4 w-4 text-fg-muted" />{s.label}</a></li>
              ))}
            </ul>
          </nav>

          <div className="space-y-8">
            <Section id="profile" title="Profile">
              <div className="flex items-center gap-4 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar} alt="" width={56} height={56} className="rounded-full border border-border" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-[13px] text-fg-muted">@{user.login} · signed in with GitHub{cfg?.kind === "github-app" ? " App" : ""}{admin ? " · platform admin" : ""}</p>
                  <p className="mt-1 text-[12px] text-fg-subtle">Name and avatar come from GitHub. Your token lives in an encrypted cookie on this browser only.</p>
                </div>
                <a href={`https://github.com/settings/profile`} target="_blank" className="btn btn-sm">Edit on GitHub</a>
                <a href="/api/auth/logout" className="btn btn-sm">Sign out</a>
              </div>
            </Section>

            <Section id="appearance" title="Appearance" hint="Theme preference is saved in this browser.">
              <div className="p-4">
                <p className="mb-3 text-[13px] text-fg-muted">Choose how Ghost-Architect looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes.</p>
                <ThemePicker />
              </div>
            </Section>

            <Section id="organisations" title="Organisations">
              <ul className="divide-y divide-border-muted">
                {orgs.map(({ org, member }) => (
                  <li key={org.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <Link href={`/org/${org.slug}`} className="font-semibold text-accent hover:underline">{org.name}</Link>
                    <span className="label label-muted">{member.role}</span>
                    {member.status !== "active" && <span className="label label-attention">{member.status}{member.lastDay ? ` · last day ${member.lastDay}` : ""}</span>}
                    <span className="ml-auto text-[12px] text-fg-muted">{member.email ? <span className="font-mono">{member.email}</span> : <span className="text-attention">no git email set</span>}</span>
                    <Link href={`/org/${org.slug}/settings`} className="btn btn-sm">Settings</Link>
                  </li>
                ))}
                {orgs.length === 0 && <li className="px-4 py-4 text-[13px] text-fg-muted">You are not in an organisation. <Link href="/org" className="text-accent hover:underline">Create one</Link> or ask a manager for an invite link.</li>}
              </ul>
            </Section>

            <Section id="data" title="Data and privacy">
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
            </Section>

            <Section id="access" title="Access">
              <ul className="list-disc space-y-1 p-4 pl-8 text-[13px] text-fg-muted">
                <li>Public repositories can be analysed by anyone, signed in or not.</li>
                <li>A private repository is only served to accounts whose GitHub token can read it, on every endpoint, including share links and reports.</li>
                <li>Saved scenarios are yours alone. Two people analysing the same repo see the same code facts but their own departed lists.</li>
                <li>Work handoffs that change GitHub access use your token once, at the moment the recipient accepts, and then drop it.</li>
              </ul>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-2 flex items-baseline gap-3 border-b border-border pb-2"><h2 className="text-[20px] font-normal">{title}</h2>{hint && <span className="text-[12px] text-fg-muted">{hint}</span>}</div>
      <div className="card">{children}</div>
    </section>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: Promise<{ cleared?: string }> }) {
  return (
    <Suspense fallback={<MascotLoader />}>
      <SettingsBody searchParams={searchParams} />
    </Suspense>
  );
}
