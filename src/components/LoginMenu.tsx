"use client";

import { useEffect, useRef, useState } from "react";

const ROLES = [
  { as: "user", title: "User", body: "An engineer. Your repos, your handovers, your inbox." },
  { as: "org", title: "Organisation", body: "A company. Members, activity logs, notices, handover tracking." },
  { as: "admin", title: "Admin", body: "Platform operators. Metrics and health; organisation data only with NDA access." },
];

/** Top-right sign-in: pick who you are, then GitHub, then the matching dashboard. */
export function LoginMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`btn ${compact ? "btn-sm" : "btn-primary"}`} aria-haspopup="menu" aria-expanded={open}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
        Sign in
        <svg viewBox="0 0 16 16" className="h-3 w-3 opacity-70" fill="currentColor" aria-hidden="true"><path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-40 w-80 rounded-md border border-border bg-canvas-overlay p-1 shadow-xl">
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Sign in with GitHub as</p>
          {ROLES.map((r) => (
            <a key={r.as} href={`/api/auth/login?as=${r.as}`} className="block rounded-md px-3 py-2 hover:bg-canvas-subtle" role="menuitem">
              <p className="text-[14px] font-semibold">{r.title}</p>
              <p className="text-[12px] text-fg-muted">{r.body}</p>
            </a>
          ))}
          <p className="px-3 pt-1 pb-2 text-[11px] text-fg-subtle">One GitHub account can hold all three roles. The choice only decides where you land.</p>
        </div>
      )}
    </div>
  );
}
