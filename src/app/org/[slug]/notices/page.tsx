import { MascotLoader } from "@/components/MascotLoader";
import { Suspense } from "react";
import { NoticeComposer } from "@/components/org/forms";
import { OrgShell } from "@/components/org/OrgShell";
import { NOTICE_TEMPLATES, noticesOf, reposOf } from "@/lib/org";
import { canManage, membersOf } from "@/lib/roles";
import { requireOrg } from "../_page";

type Params = Promise<{ slug: string }>;

async function Body({ params }: { params: Params }) {
  const { slug } = await params;
  const { user, access } = await requireOrg(slug);
  if (!access.ok) return <main className="p-10 text-fg-muted">{access.message}</main>;
  const manager = canManage(access.role);
  const [members, repos, notices] = await Promise.all([membersOf(access.org.id), reposOf(access.org.id), manager ? noticesOf(access.org.id) : Promise.resolve([])]);
  return (
    <OrgShell org={access.org} role={access.role} user={user} active="/notices">
      {manager ? (
        <>
          <section className="card">
            <div className="card-header">Send a notice or letter</div>
            <div className="p-4"><NoticeComposer slug={access.org.slug} members={members.filter((m) => m.status !== "left")} templates={NOTICE_TEMPLATES} repos={repos.map((r) => r.repoUrl)} /></div>
          </section>
          <section className="card">
            <div className="card-header">Sent <span className="counter ml-1">{notices.length}</span></div>
            <ul className="divide-y divide-border-muted">
              {notices.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="label label-muted">{NOTICE_TEMPLATES[n.type]?.label ?? n.type}</span>
                  <a href={`/letter/${n.id}`} className="font-semibold text-accent hover:underline">{n.subject}</a>
                  <span className="text-fg-muted">to @{n.toLogin} · {n.createdAt.slice(0, 16).replace("T", " ")} · by @{n.createdBy}</span>
                  <span className={`ml-auto label ${n.status === "acknowledged" ? "label-success" : n.status === "read" ? "label-accent" : "label-attention"}`}>{n.status}{n.ackAt ? ` ${n.ackAt.slice(0, 10)}` : n.readAt ? ` ${n.readAt.slice(0, 10)}` : ""}</span>
                </li>
              ))}
              {notices.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-fg-muted">Nothing sent yet.</li>}
            </ul>
          </section>
        </>
      ) : (
        <section className="card"><div className="blankslate !py-8"><h3>Notices are sent by managers</h3><p>Anything sent to you appears in your inbox.</p><a href="/me" className="btn mt-3">Open inbox</a></div></section>
      )}
    </OrgShell>
  );
}

export default function Page({ params }: { params: Params }) {
  return <Suspense fallback={<MascotLoader />}><Body params={params} /></Suspense>;
}
