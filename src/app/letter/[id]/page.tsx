import { MascotLoader } from "@/components/MascotLoader";
import { Suspense } from "react";
import { get } from "@/lib/db";
import { NOTICE_TEMPLATES } from "@/lib/org";
import { canManage, membership } from "@/lib/roles";
import { getSession } from "@/lib/session";
import type { Member, Notice, Org } from "@/lib/types";

/** A notice as a printable letter. Visible to its recipient and to the organisation's managers. */
async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const n = await get<Notice>("notices", id);
  const org = n ? await get<Org>("orgs", n.orgId) : null;
  const me = session?.login.toLowerCase();
  const m = n && me ? await membership(n.orgId, me) : null;
  const allowed = n && me && (n.toLogin === me || (m && canManage(m.role)));
  if (!n || !org || !allowed) return <main className="mx-auto max-w-xl p-10 font-sans" style={{ colorScheme: "light" }}><p>This letter is not available to you.</p></main>;
  const to = await get<Member>("members", `${n.orgId}:${n.toLogin}`);
  return (
    <main className="mx-auto max-w-2xl bg-white p-12 font-serif text-[#1f2328] print:p-0" style={{ colorScheme: "light" }}>
      <div className="flex items-baseline justify-between border-b border-[#d1d9e0] pb-4">
        <p className="text-2xl font-semibold">{org.name}</p>
        <p className="text-sm text-[#59636e]">{n.createdAt.slice(0, 10)}</p>
      </div>
      <p className="mt-8 text-sm text-[#59636e]">{NOTICE_TEMPLATES[n.type]?.label ?? n.type}</p>
      <p className="mt-1 text-sm">To: {to?.name ?? n.toLogin} (@{n.toLogin}){to?.email ? ` · ${to.email}` : ""}</p>
      <h1 className="mt-6 text-xl font-semibold">{n.subject}</h1>
      <pre className="mt-4 whitespace-pre-wrap font-serif text-[15px] leading-7">{n.body}</pre>
      <p className="mt-10 text-sm text-[#59636e]">Sent by @{n.createdBy} via Ghost-Architect · {n.status}{n.ackAt ? `, acknowledged ${n.ackAt.slice(0, 10)}` : n.readAt ? `, read ${n.readAt.slice(0, 10)}` : ""}</p>
      <p className="mt-6 text-xs text-[#818b98] print:hidden">Use your browser&rsquo;s print dialog to save as PDF.</p>
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<MascotLoader />}><Body params={params} /></Suspense>;
}
