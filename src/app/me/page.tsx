import { MascotLoader } from "@/components/MascotLoader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/Mascot";
import { Countdown } from "@/components/Countdown";
import { HandoverWorkspace } from "@/components/me/HandoverWorkspace";
import { stripQuiz } from "@/lib/quiz-client";
import { Inbox } from "@/components/me/Inbox";
import { TransferComposer, WorkTransfers } from "@/components/me/WorkTransfers";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { handoversFor, inboxOf } from "@/lib/org";
import { isAdmin, orgsOf } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata = { title: "Inbox and handovers" };

async function Body() {
  const session = await getSession();
  if (!session) redirect("/api/auth/login?as=user");
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const [notices, handovers, orgs] = await Promise.all([inboxOf(session.login), handoversFor(session.login), orgsOf(session.login)]);
  const unread = notices.filter((n) => n.status === "sent").length;
  const open = handovers.filter((h) => h.status === "open");
  const leaving = orgs.filter(({ member }) => member.status === "leaving" || member.lastDay);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">My repositories</Link>
            <Link href="/org" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Organisations</Link>
            <span className="rounded-md px-2 py-1 font-semibold">Inbox{unread ? <span className="counter ml-1">{unread}</span> : null}</span>
            {isAdmin(session.login) && <Link href="/admin" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Admin</Link>}
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto grid max-w-[1100px] gap-4 px-4 py-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-[57px] lg:max-h-[calc(100vh-57px-1.5rem)] lg:overflow-y-auto lg:pr-1 thin-scroll">
          <TransferComposer organisations={orgs.filter(({ member }) => member.status !== "left").map(({ org }) => ({ id: org.id, name: org.name }))} />
          <section className="card">
            <div className="card-header"><Octicon name="report" className="h-4 w-4 text-fg-muted" />Inbox {unread > 0 && <span className="counter ml-1">{unread} new</span>}</div>
            <Inbox notices={notices} />
          </section>
          <section className="card">
            <div className="card-header"><Octicon name="people" className="h-4 w-4 text-fg-muted" />Your organisations</div>
            <ul className="divide-y divide-border-muted">
              {orgs.map(({ org, member }) => <li key={org.id} className="flex items-center gap-2 px-4 py-2 text-[13px]"><Link href={`/org/${org.slug}`} className="text-accent hover:underline">{org.name}</Link><span className="label label-muted">{member.role}</span>{member.status !== "active" && <span className="label label-attention">{member.status}{member.lastDay ? ` · last day ${member.lastDay}` : ""}</span>}{!member.email && <span className="ml-auto text-[11px] text-attention">set your git email</span>}</li>)}
              {orgs.length === 0 && <li className="px-4 py-4 text-[13px] text-fg-muted">Not in an organisation yet. Ask a manager for an invite link.</li>}
            </ul>
          </section>
        </div>
        <div className="space-y-4">
          {leaving.length > 0 && (
            <section className="card">
              <div className="card-header"><Octicon name="clock" className="h-4 w-4 text-fg-muted" />Your countdown</div>
              {leaving.map(({ org, member }) => <Countdown key={org.id} name="You" lastDay={member.lastDay} handovers={handovers.filter((h) => h.orgId === org.id && h.leaverLogin === session.login.toLowerCase())} />)}
            </section>
          )}
          <WorkTransfers />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-muted">Handovers {open.length > 0 && <span className="counter ml-1">{open.length} open</span>}</h2>
          {handovers.map((h) => <HandoverWorkspace key={h.id} handover={stripQuiz(h)} meLogin={session.login.toLowerCase()} />)}
          {handovers.length === 0 && <section className="card"><div className="blankslate !py-8"><h3>No handovers</h3><p>When a manager assigns you one, as the person leaving or the one receiving, it appears here with the files, notes and links.</p></div></section>}
        </div>
      </main>
    </div>
  );
}

export default function Me() {
  return <Suspense fallback={<MascotLoader />}><Body /></Suspense>;
}
