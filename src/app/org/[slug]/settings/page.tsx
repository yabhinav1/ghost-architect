import { Suspense } from "react";
import { RenameOrg, SupportAccessToggle } from "@/components/org/forms";
import { OrgShell } from "@/components/org/OrgShell";
import { list } from "@/lib/db";
import { canManage } from "@/lib/roles";
import type { AuditEntry } from "@/lib/types";
import { requireOrg } from "../_page";

type Params = Promise<{ slug: string }>;

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const { user, access } = await requireOrg(slug);
  if (!access.ok) return <main className="p-10 text-fg-muted">{access.message}</main>;
  const manager = canManage(access.role);
  const audit = manager ? (await list<AuditEntry>("audit", (a) => a.orgId === access.org.id)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100) : [];
  return (
    <OrgShell org={access.org} role={access.role} user={user} active="/settings">
      <section className="card">
        <div className="card-header">Confidentiality</div>
        <div className="space-y-3 p-4 text-[13px]">
          <p className="text-fg-muted">Everything inside this organisation (repositories, activity, notices, handovers) is visible only to its members. The people who run Ghost-Architect cannot open it, even for support, unless you grant access here. Granting is logged with who did it and when, and can be revoked at any time.</p>
          {access.role === "owner" ? <SupportAccessToggle slug={access.org.slug} enabled={access.org.supportAccess} changedAt={access.org.supportAccessChangedAt} changedBy={access.org.supportAccessChangedBy} /> : <p className="text-fg-subtle">Only an owner can change this. Current state: {access.org.supportAccess ? "support access granted" : "private"}.</p>}
        </div>
      </section>
      {access.role === "owner" && (
        <section className="card"><div className="card-header">Organisation</div><div className="p-4"><RenameOrg slug={access.org.slug} name={access.org.name} /></div></section>
      )}
      {manager && (
        <section className="card">
          <div className="card-header">Audit log <span className="counter ml-1">{audit.length}</span></div>
          <ul className="divide-y divide-border-muted">
            {audit.map((a) => <li key={a.id} className="flex flex-wrap gap-3 px-4 py-1.5 text-[12px]"><span className="text-fg-muted">{a.at.slice(0, 16).replace("T", " ")}</span><span>@{a.actor}</span><span className="font-mono">{a.action}</span>{a.target && <span className="truncate text-fg-muted">{a.target}</span>}</li>)}
            {audit.length === 0 && <li className="px-4 py-4 text-[13px] text-fg-muted">Nothing yet.</li>}
          </ul>
        </section>
      )}
    </OrgShell>
  );
}

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<div className="min-h-screen" />}><Body params={params} /></Suspense>;
}
