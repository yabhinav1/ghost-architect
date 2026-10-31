import Link from "next/link";
import { Suspense } from "react";
import { ActivityTable } from "@/components/org/ActivityTable";
import { OrgShell } from "@/components/org/OrgShell";
import { activityFeed } from "@/lib/org";
import { requireOrg } from "../_page";

type Params = Promise<{ slug: string }>;

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const { user, access } = await requireOrg(slug);
  if (!access.ok) return <main className="p-10 text-fg-muted">{access.message}</main>;
  const feed = await activityFeed(access.org);
  const unmatched = Object.entries(feed.unmatchedEmails).sort((a, b) => b[1].commits - a[1].commits);
  return (
    <OrgShell org={access.org} role={access.role} user={user} active="/activity">
      <section className="card">
        <div className="card-header">Activity log <span className="counter ml-1">{feed.events.length}</span><span className="ml-auto text-[11px] font-normal text-fg-muted">{feed.analysed} of {feed.total} linked repositories analysed · commits from the last few years, newest first</span></div>
        {feed.total === 0 ? (
          <p className="px-4 py-6 text-[13px] text-fg-muted">Link repositories on the <Link href={`/org/${access.org.slug}`} className="text-accent">overview</Link> first.</p>
        ) : feed.analysed === 0 ? (
          <p className="px-4 py-6 text-[13px] text-fg-muted">None of the linked repositories has been analysed yet. Click Analyse next to a repository on the overview.</p>
        ) : (
          <ActivityTable events={feed.events} />
        )}
      </section>
      {unmatched.length > 0 && (
        <section className="card">
          <div className="card-header">Commit authors who are not matched to a member <span className="counter ml-1">{unmatched.length}</span></div>
          <p className="px-4 pt-3 text-[12px] text-fg-muted">Set the git email on a member (Overview, Edit) and their commits attach to them. Bots and ex-employees stay here.</p>
          <ul className="divide-y divide-border-muted">
            {unmatched.slice(0, 40).map(([email, v]) => <li key={email} className="flex items-center gap-3 px-4 py-1.5 text-[12px]"><span className="font-mono">{email}</span><span className="text-fg-muted">{v.name}</span><span className="counter ml-auto">{v.commits}</span></li>)}
          </ul>
        </section>
      )}
    </OrgShell>
  );
}

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<div className="min-h-screen" />}><Body params={params} /></Suspense>;
}
