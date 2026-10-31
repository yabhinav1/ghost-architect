"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { InboxSummary } from "@/lib/types";

type Feed = { data: InboxSummary | null; error: string; refresh: () => void; connect: (login: string) => void };
const Context = createContext<Feed>({ data: null, error: "", refresh: () => {}, connect: () => {} });

export function InboxProvider({ children }: { children: ReactNode }) {
  const [login, connect] = useState("");
  const [snapshot, setSnapshot] = useState<{ login: string; data: InboxSummary } | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(() => window.dispatchEvent(new Event("inbox-updated")), []);
  useEffect(() => {
    if (!login) return;
    let active = true;
    let controller: AbortController | null = null;
    const load = async () => {
      if (document.hidden) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch("/api/me/inbox", { signal: request.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Inbox unavailable.");
        if (active && !request.signal.aborted) { setSnapshot({ login, data: result }); setError(""); }
      } catch (e) {
        if (active && !request.signal.aborted) setError(e instanceof Error ? e.message : "Inbox unavailable.");
      }
    };
    void load();
    const interval = setInterval(load, 30000);
    window.addEventListener("inbox-updated", load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; controller?.abort(); clearInterval(interval); window.removeEventListener("inbox-updated", load); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [login]);
  return <Context.Provider value={{ data: snapshot?.login === login ? snapshot.data : null, error, connect, refresh }}>{children}</Context.Provider>;
}

export function useInbox() { return useContext(Context); }

export function InboxBox({ compact = false }: { compact?: boolean }) {
  const { data, error, refresh } = useInbox();
  const recent = data?.items.slice(0, compact ? 4 : 3) ?? [];
  return <section className={compact ? "" : "card"} aria-label="Inbox messages">
    <div className="card-header flex flex-wrap items-center justify-between gap-2">
      <Link href="/me" className="font-semibold hover:text-accent">Inbox messages {data && data.unread > 0 && <span className="counter">{data.unread} unread</span>}</Link>
      <Link href="/me#send-work" className="text-xs text-accent hover:underline">Transfer work</Link>
    </div>
    {error && <p role="status" className="px-4 py-2 text-xs text-attention">{error} <button onClick={refresh} className="underline">Retry</button></p>}
    {!data && !error && <p className="p-4 text-sm text-fg-muted">Loading messages…</p>}
    {data && <ul className="divide-y divide-border-muted">{recent.map((item) => <li key={item.id}><Link href={item.href} className={`block px-4 py-3 hover:bg-canvas-subtle ${item.unread ? "bg-accent-muted/30" : ""}`}>
      <p className={`truncate text-sm ${item.unread ? "font-semibold" : ""}`}>{item.unread && <span className="mr-1 text-accent" aria-label="Unread">●</span>}{item.title}</p>
      <p className="truncate text-xs text-fg-muted">{item.detail}</p>
    </Link></li>)}{!recent.length && <li className="p-4 text-sm text-fg-muted">You’re all caught up. Work handoffs and organisation notices appear here.</li>}</ul>}
    <Link href="/me" className="block border-t border-border-muted px-4 py-2 text-xs text-accent hover:underline">View all messages and handoffs →</Link>
  </section>;
}

export function InboxBell({ login }: { login: string }) {
  const { connect, data, error } = useInbox();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => connect(login), [connect, login]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={ref} className="relative">
    <button type="button" className="btn btn-sm gap-1" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Inbox${data ? `, ${data.unread} unread` : ""}${error ? ", refresh failed" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" /></svg>
      <span className="hidden sm:inline">Inbox</span>{!!data?.unread && <span className="counter !bg-accent !text-white">{data.unread > 99 ? "99+" : data.unread}</span>}{error && <span className="text-attention">!</span>}
    </button>
    <span className="sr-only" role="status">{data ? `${data.unread} unread inbox messages` : ""}</span>
    {open && <div className="absolute right-0 top-10 z-50 w-[min(360px,calc(100vw-5rem))] overflow-hidden rounded-lg border border-border bg-canvas-overlay shadow-xl" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}><InboxBox compact /></div>}
  </div>;
}
