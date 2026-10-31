import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mascot } from "@/components/Mascot";
import { AcceptInvite } from "./AcceptInvite";
import { get } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { Invite, Org } from "@/lib/types";

async function Body({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  if (!session) redirect(`/api/auth/login?as=user`);
  const inv = await get<Invite>("invites", token);
  const org = inv ? await get<Org>("orgs", inv.orgId) : null;
  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-md p-6 text-center">
        <Mascot size={80} className="mx-auto" />
        {!inv || !org ? (
          <><h1 className="mt-3 text-xl font-semibold">Invite not valid</h1><p className="mt-2 text-[13px] text-fg-muted">The link is wrong or already used.</p><Link href="/dashboard" className="btn mt-4">Dashboard</Link></>
        ) : inv.acceptedAt ? (
          <><h1 className="mt-3 text-xl font-semibold">Already used</h1><p className="mt-2 text-[13px] text-fg-muted">This invite to {org.name} was accepted by @{inv.acceptedBy}.</p><Link href={`/org/${org.slug}`} className="btn mt-4">Open {org.name}</Link></>
        ) : (
          <><h1 className="mt-3 text-xl font-semibold">Join {org.name}</h1><p className="mt-2 text-[13px] text-fg-muted">You&rsquo;re signed in as <b className="text-fg">@{session.login}</b> and would join as <b className="text-fg">{inv.role}</b>.{inv.login && inv.login !== session.login.toLowerCase() ? ` This invite is for @${inv.login}.` : ""}</p><AcceptInvite token={token} slug={org.slug} /></>
        )}
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<div className="min-h-screen" />}><Body params={params} /></Suspense>;
}
