import { MascotLoader } from "@/components/MascotLoader";
import Link from "next/link";
import { Suspense } from "react";
import { HandoverCreator } from "@/components/org/forms";
import { Countdown } from "@/components/Countdown";
import { PendingWork } from "@/components/PendingWork";
import { bestAttempt, PASS_MARK } from "@/lib/packet";
import { OrgShell } from "@/components/org/OrgShell";
import { handoversOf, reposOf } from "@/lib/org";
import { canManage, membersOf } from "@/lib/roles";
import { requireOrg } from "../_page";

type Params = Promise<{ slug: string }>;

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const { session, user, access } = await requireOrg(slug);
  if (!access.ok) return <main className="p-10 text-fg-muted">{access.message}</main>;
  const manager = canManage(access.role);
  const me = session.login.toLowerCase();
  const [members, repos, all] = await Promise.all([membersOf(access.org.id), reposOf(access.org.id), handoversOf(access.org.id)]);
  const handovers = manager ? all : all.filter((h) => h.leaverLogin === me || h.receiverLogin === me);
  const nameOf = (login: string) => members.find((m) => m.login === login)?.name ?? `@${login}`;
  const leavers = members.filter((m) => (m.status === "leaving" || m.lastDay) && handovers.some((h) => h.leaverLogin === m.login));
  return (
    <OrgShell org={access.org} role={access.role} user={user} active="/handovers">
      {manager && (
        <section className="card">
          <div className="card-header">Assign a handover</div>
          <div className="p-4">
            {repos.length === 0 ? <p className="text-[13px] text-fg-muted">Link and analyse a repository first.</p> : <HandoverCreator slug={access.org.slug} members={members.filter((m) => m.status !== "left")} repos={repos.map((r) => r.repoUrl)} />}
            <p className="mt-3 text-[12px] text-fg-subtle">Files are picked from the analysis: the leaver&rsquo;s most-owned, most-changed, most-imported files. Both people get a notice. The leaver records notes and links per file and ticks them off; you watch progress here.</p>
          </div>
        </section>
      )}
      {leavers.length > 0 && (
        <section className="card">
          <div className="card-header">Countdown <span className="ml-1 font-normal text-fg-muted">days left against what is still open</span></div>
          <div className="divide-y divide-border-muted">
            {leavers.map((m) => <Countdown key={m.id} name={m.name || `@${m.login}`} lastDay={m.lastDay} handovers={handovers.filter((h) => h.leaverLogin === m.login)} compact />)}
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-header">Handovers <span className="counter ml-1">{handovers.length}</span></div>
        <ul className="divide-y divide-border-muted">
          {handovers.map((h) => {
            const done = h.files.filter((f) => f.done).length;
            const pct = h.files.length ? Math.round((done / h.files.length) * 100) : 0;
            const overdue = h.dueDate && h.status === "open" && h.dueDate < new Date().toISOString().slice(0, 10);
            const best = bestAttempt(h, h.receiverLogin);
            const passed = Boolean(best && best.score / best.total >= PASS_MARK);
            return (
              <li key={h.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <Link href={`/me#handover-${h.id}`} className="font-mono text-accent hover:underline">{h.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "")}</Link>
                  <span>{nameOf(h.leaverLogin)} <span className="text-fg-muted">→</span> {nameOf(h.receiverLogin)}</span>
                  {h.dueDate && <span className={`label ${overdue ? "label-danger" : "label-muted"}`}>due {h.dueDate}</span>}
                  {h.quiz && <span className={`label ${passed ? "label-success" : best ? "label-attention" : "label-muted"}`} title="Knowledge check">{passed ? `KT passed ${best!.score}/${best!.total}` : best ? `KT ${best.score}/${best.total}` : "KT not taken"}</span>}
                  <Link href={`/packet/${h.id}`} className="text-[12px] text-accent hover:underline">day-one packet</Link>
                  <span className={`ml-auto label ${h.status === "complete" ? "label-success" : pct > 0 ? "label-accent" : "label-attention"}`}>{h.status === "complete" ? "complete" : `${done}/${h.files.length} files`}</span>
                </div>
                <div className="progress mt-2"><span style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 rounded-md border border-border-muted"><PendingWork slug={access.org.slug} login={h.leaverLogin} repoUrl={h.repoUrl} files={h.files} quiz={h.quiz ? (passed ? "passed" : "not passed") : undefined} /></div>
              </li>
            );
          })}
          {handovers.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-fg-muted">No handovers yet.</li>}
        </ul>
      </section>
    </OrgShell>
  );
}

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<MascotLoader />}><Body params={params} /></Suspense>;
}
