import Link from "next/link";
import { Mark } from "@/components/Mascot";
import { UserMenu } from "@/components/UserMenu";
import type { Org, SessionUser } from "@/lib/types";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/activity", label: "Activity log" },
  { href: "/notices", label: "Notices" },
  { href: "/handovers", label: "Handovers" },
  { href: "/settings", label: "Settings" },
];

export function OrgShell({ org, role, user, active, children }: { org: Org; role: string; user: SessionUser; active: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5">
          <Link href="/org" className="flex items-center gap-2 font-semibold"><Mark size={26} className="text-fg" />Ghost-Architect</Link>
          <nav className="ml-4 hidden items-center gap-1 text-[13px] sm:flex">
            <Link href="/dashboard" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">My repositories</Link>
            <Link href="/org" className="rounded-md px-2 py-1 font-semibold">Organisations</Link>
            <Link href="/me" className="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Inbox</Link>
          </nav>
          <span className="ml-auto" />
          <UserMenu user={user} />
        </div>
      </header>
      <div className="border-b border-border bg-canvas-subtle">
        <div className="mx-auto max-w-[1200px] px-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{org.name}</h1>
            <span className="label label-muted">{role === "admin-support" ? "admin (support access)" : role}</span>
            {org.supportAccess && <span className="label label-attention" title="Platform admins can view this organisation">support access on</span>}
            <span className="text-[12px] text-fg-muted">/{org.slug}</span>
          </div>
          <div className="underline-nav mt-3">
            {TABS.map((t) => (
              <Link key={t.href} href={`/org/${org.slug}${t.href}`} className={`px-3 py-2 text-[14px] ${active === t.href ? "border-b-2 border-[#f78166] font-semibold text-fg" : "text-fg-muted hover:text-fg"}`}>{t.label}</Link>
            ))}
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-[1200px] space-y-4 px-4 py-5">{children}</main>
    </div>
  );
}
