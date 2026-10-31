"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/lib/types";
import { InboxBell } from "@/components/InboxFeed";

export function UserMenu({ user, admin = false }: { user: SessionUser; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="flex items-center gap-3"><InboxBell login={user.login} /><div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-border p-0.5 hover:border-fg-subtle" aria-haspopup="menu" aria-expanded={open}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatar} alt="" width={26} height={26} className="rounded-full" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-40 w-56 rounded-md border border-border bg-canvas-overlay py-1 text-[13px] shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="font-semibold">{user.name}</p>
            <p className="text-fg-muted">@{user.login}</p>
          </div>
          <Link href="/dashboard" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Your repositories</Link>
          <Link href="/me" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Inbox and handovers</Link>
          <Link href="/org" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Organisations</Link>
          {admin && <Link href="/admin" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Platform admin</Link>}
          <Link href="/analyse" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Analyse any public repo</Link>
          <Link href="/settings" className="block px-3 py-1.5 hover:bg-canvas-subtle" onClick={() => setOpen(false)}>Settings</Link>
          <a href={`https://github.com/${user.login}`} target="_blank" className="block px-3 py-1.5 hover:bg-canvas-subtle">GitHub profile</a>
          <div className="my-1 border-t border-border" />
          <a href="/api/auth/logout" className="block px-3 py-1.5 text-danger hover:bg-canvas-subtle">Sign out</a>
        </div>
      )}
    </div></div>
  );
}
