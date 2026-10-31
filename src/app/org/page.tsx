import { MascotLoader } from "@/components/MascotLoader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Mark } from "@/components/Mascot";
import { CreateOrgForm } from "@/components/org/forms";
import { Octicon } from "@/components/ui";
import { UserMenu } from "@/components/UserMenu";
import { InboxBox } from "@/components/InboxFeed";
import { isAdmin, orgsOf } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata = { title: "Organisations" };

async function Body() {
  const session = await getSession();
  if (!session) redirect("/api/auth/login?as=org");
  const user = { login: session.login, name: session.name, avatar: session.avatar };
  const mine = await orgsOf(session.login);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1000px] items-center gap-3 px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">My repositories</Link>
            <span className="rounded-md px-2 py-1 font-semibold">Organisations</span>
            <Link href="/me" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Inbox</Link>
            {isAdmin(session.login) && <Link href="/admin" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Admin</Link>}
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-[1000px] space-y-4 px-4 py-6">
        <InboxBox />
        <section className="card">
          <div className="card-header"><Octicon name="people" className="h-4 w-4 text-fg-muted" />Your organisations</div>
          {mine.length === 0 ? (
            <div className="blankslate !py-8"><h3>No organisation yet</h3><p>Create one for your company, or ask a manager for an invite link.</p></div>
          ) : (
            <ul className="divide-y divide-border-muted">
              {mine.map(({ org, member }) => (
                <li key={org.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/org/${org.slug}`} className="text-[15px] font-semibold text-accent hover:underline">{org.name}</Link>
                  <span className="label label-muted">{member.role}</span>
                  {member.status !== "active" && <span className="label label-attention">{member.status}</span>}
                  <span className="ml-auto text-[12px] text-fg-muted">joined {member.joinedAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="card-header">Create an organisation</div>
          <div className="p-4">
            <CreateOrgForm />
            <p className="mt-3 text-[12px] text-fg-subtle">You become its owner. Owners and managers link repositories, invite engineers, read the activity log, send notices and assign handovers. Platform admins see nothing inside it unless you grant support access in Settings.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function OrgHub() {
  return <Suspense fallback={<MascotLoader />}><Body /></Suspense>;
}
