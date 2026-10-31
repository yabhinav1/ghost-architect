import Link from "next/link";
import { Suspense } from "react";
import { AddRepoForm, InviteForm, MemberRow, RepoActions } from "@/components/org/forms";
import { OrgShell } from "@/components/org/OrgShell";
import { Octicon } from "@/components/ui";
import { repoSummaries } from "@/lib/org";
import { canManage, membersOf } from "@/lib/roles";
import { requireOrg } from "./_page";

type Params = Promise<{ slug: string }>;

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const { session, user, access } = await requireOrg(slug);
  if (!access.ok) return <main className="mx-auto max-w-xl p-10"><h1 className="text-xl font-semibold">Can&rsquo;t open this organisation</h1><p className="mt-2 text-fg-muted">{access.message}</p><Link href="/org" className="btn mt-4">Your organisations</Link></main>;
  const [members, repos] = await Promise.all([membersOf(access.org.id), repoSummaries(access.org)]);
  const manager = canManage(access.role);
  const fragile = repos.filter((r) => r.summary?.level === "fragile").length;
  return (
    <OrgShell org={access.org} role={access.role} user={user} active="">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Members" value={String(members.length)} />
        <Stat label="Leaving" value={String(members.filter((m) => m.status === "leaving").length)} accent={members.some((m) => m.status === "leaving")} />
        <Stat label="Repositories" value={String(repos.length)} />
        <Stat label="Fragile repos" value={String(fragile)} accent={fragile > 0} />
      </section>

      <section className="card">
        <div className="card-header"><Octicon name="repo" className="h-4 w-4 text-fg-muted" />Repositories <span className="counter ml-1">{repos.length}</span></div>
        {repos.length === 0 && <p className="px-4 py-4 text-[13px] text-fg-muted">No repositories linked yet. Link the ones this organisation owns; analyses power the activity log and handovers.</p>}
        <ul className="divide-y divide-border-muted">
          {repos.map(({ repo, summary }) => {
            const s = repo.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
            return (
              <li key={repo.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Link href={`/r/${s}`} className="font-mono text-[13px] text-accent hover:underline">{s}</Link>
                {summary ? (
                  <>
                    <span className={`label ${summary.level === "fragile" ? "label-danger" : summary.level === "watch" ? "label-attention" : "label-success"}`}>{summary.level}</span>
                    <span className="text-[12px] text-fg-muted">bus factor {summary.busFactor} · top owner {Math.round(summary.topShare * 100)}% ({summary.topAuthor}) · {summary.fragileFiles} fragile files · analysed {summary.analyzedAt.slice(0, 10)}</span>
                  </>
                ) : (
                  <span className="label label-muted">not analysed yet</span>
                )}
                {manager && <span className="ml-auto"><RepoActions slug={access.org.slug} repoUrl={repo.repoUrl} analysed={Boolean(summary)} /></span>}
              </li>
            );
          })}
        </ul>
        {manager && <div className="border-t border-border p-4"><AddRepoForm slug={access.org.slug} /></div>}
      </section>

      <section className="card">
        <div className="card-header"><Octicon name="people" className="h-4 w-4 text-fg-muted" />Members <span className="counter ml-1">{members.length}</span><span className="ml-auto text-[11px] font-normal text-fg-muted">git email is how commits are matched to people</span></div>
        <ul className="divide-y divide-border-muted">
          {members.map((m) => <MemberRow key={m.id} slug={access.org.slug} member={m} me={session.login} manager={manager} isOwner={access.role === "owner"} />)}
        </ul>
        {manager && <div className="border-t border-border p-4"><p className="mb-2 text-[12px] font-semibold text-fg-muted">Invite an engineer or manager</p><InviteForm slug={access.org.slug} canInviteOwner={access.role === "owner"} /></div>}
      </section>
    </OrgShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="card p-3"><p className="text-[12px] text-fg-muted">{label}</p><p className={`text-2xl font-semibold ${accent ? "text-danger" : ""}`}>{value}</p></div>;
}

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<div className="min-h-screen" />}><Body params={params} /></Suspense>;
}
