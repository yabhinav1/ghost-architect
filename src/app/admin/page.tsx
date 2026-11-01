import { MascotLoader } from "@/components/MascotLoader";
import fs from "node:fs/promises";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/Mascot";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { InboxBox } from "@/components/InboxFeed";
import { list } from "@/lib/db";
import { cacheDir } from "@/lib/git";
import { laneSummary } from "@/lib/llm";
import { mailConfig, verifySmtp } from "@/lib/mail";
import { MailTest } from "@/components/admin/MailTest";
import { isAdmin } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { storeEnabled } from "@/lib/store";
import type { AuditEntry, Handover, Member, Notice, Org, OrgRepo } from "@/lib/types";

export const metadata = { title: "Admin" };

async function Body() {
  const session = await getSession();
  if (!session) redirect("/api/auth/login?as=admin");
  if (!isAdmin(session.login)) {
    return (
      <main className="mx-auto max-w-xl p-10">
        <h1 className="text-xl font-semibold">Not a platform admin</h1>
        <p className="mt-2 text-[13px] text-fg-muted">@{session.login} is not listed in ADMIN_LOGINS on this server. Admins are the people who run Ghost-Architect, not organisation owners. Organisation settings live under each organisation.</p>
        <Link href="/dashboard" className="btn mt-4">Back to dashboard</Link>
      </main>
    );
  }
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const [orgs, members, repos, notices, handovers, audit] = await Promise.all([list<Org>("orgs"), list<Member>("members"), list<OrgRepo>("orgRepos"), list<Notice>("notices"), list<Handover>("handovers"), list<AuditEntry>("audit")]);
  let analyses = 0;
  try {
    analyses = (await fs.readdir(cacheDir("analysis"))).filter((n) => n.endsWith(".json")).length;
  } catch {
    // none
  }
  const lanes = laneSummary();
  const mail = mailConfig();
  const mailStatus = mail.configured ? ((await verifySmtp()).ok ? mail.provider : `${mail.provider}-failing`) : "outbox";
  const platformAudit = audit.filter((a) => a.orgId === null || a.action.startsWith("org.supportAccess") || a.action === "org.create").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5">
          <Link href="/admin" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect <span className="label label-danger ml-1">admin</span></Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">My repositories</Link>
            <Link href="/org" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Organisations</Link>
            <Link href="/me" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Inbox</Link>
            <span className="rounded-md px-2 py-1 font-semibold">Admin</span>
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
        <InboxBox />
        <p className="rounded-md border border-border bg-canvas-subtle px-3 py-2 text-[12px] text-fg-muted">Platform view. Organisation contents (repositories, logs, notices, handovers) are confidential to their members. You can open an organisation only after its owner grants support access, and each grant and revoke is audited.</p>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {[["Organisations", orgs.length], ["Memberships", members.length], ["People", new Set(members.map((m) => m.login)).size], ["Linked repos", repos.length], ["Analyses cached", analyses], ["Notices", notices.length], ["Handovers", handovers.length], ["Open handovers", handovers.filter((h) => h.status === "open").length]].map(([l, v]) => (
            <div key={String(l)} className="card p-3"><p className="text-[11px] text-fg-muted">{l}</p><p className="text-2xl font-semibold">{v}</p></div>
          ))}
        </section>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="card">
            <div className="card-header"><Octicon name="people" className="h-4 w-4 text-fg-muted" />Organisations</div>
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-border-muted text-left text-fg-muted"><th className="px-4 py-1.5 font-medium">Name</th><th className="py-1.5 font-medium">Created</th><th className="py-1.5 font-medium">Members</th><th className="py-1.5 font-medium">Repos</th><th className="py-1.5 pr-4 font-medium">Support access</th></tr></thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-border-muted">
                    <td className="px-4 py-1.5">{o.supportAccess ? <Link href={`/org/${o.slug}`} className="text-accent hover:underline">{o.name}</Link> : <span>{o.name}</span>} <span className="text-fg-muted">/{o.slug}</span></td>
                    <td className="py-1.5 text-fg-muted">{o.createdAt.slice(0, 10)} by @{o.createdBy}</td>
                    <td className="py-1.5">{members.filter((m) => m.orgId === o.id).length}</td>
                    <td className="py-1.5">{repos.filter((r) => r.orgId === o.id).length}</td>
                    <td className="py-1.5 pr-4">{o.supportAccess ? <span className="label label-attention">granted {o.supportAccessChangedAt?.slice(0, 10)}</span> : <span className="label label-success">private</span>}</td>
                  </tr>
                ))}
                {orgs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-fg-muted">No organisations yet.</td></tr>}
              </tbody>
            </table>
          </section>
          <div className="space-y-4">
            <section className="card">
              <div className="card-header">Platform health</div>
              <ul className="divide-y divide-border-muted text-[12px]">
                <li className="flex items-center justify-between px-4 py-2"><span>Health check</span><a href="/api/health" className="text-accent hover:underline">/api/health</a></li>
                <MailTest status={mailStatus} defaultTo={mail.user ?? ""} />
                <li className="flex items-center justify-between px-4 py-2"><span>Durable store</span><span className={`label ${storeEnabled ? "label-success" : "label-attention"}`}>{storeEnabled ? "on" : "off (disk only)"}</span></li>
                <li className="px-4 py-2"><p>Model lanes</p><ul className="mt-1 space-y-0.5 font-mono text-[11px] text-fg-muted">{lanes.map((l) => <li key={l.id}>{l.model}{l.coolingFor ? ` · cooling ${l.coolingFor}s` : " · ready"}</li>)}{lanes.length === 0 && <li>no LLM configured</li>}</ul></li>
              </ul>
            </section>
            <section className="card">
              <div className="card-header">Platform audit</div>
              <ul className="divide-y divide-border-muted">
                {platformAudit.map((a) => <li key={a.id} className="flex flex-wrap gap-2 px-4 py-1.5 text-[11px]"><span className="text-fg-muted">{a.at.slice(0, 16).replace("T", " ")}</span><span>@{a.actor}</span><span className="font-mono">{a.action}</span><span className="text-fg-muted">{a.target}</span></li>)}
                {platformAudit.length === 0 && <li className="px-4 py-3 text-[12px] text-fg-muted">Nothing yet.</li>}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Admin() {
  return <Suspense fallback={<MascotLoader />}><Body /></Suspense>;
}
