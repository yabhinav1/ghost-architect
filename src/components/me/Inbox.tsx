"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Notice } from "@/lib/types";

type Item = Notice & { orgName: string; orgSlug: string };

export function Inbox({ notices }: { notices: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function mark(id: string, action: "read" | "acknowledge") {
    setBusy(id);
    await fetch(`/api/me/notices/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(null);
    router.refresh();
  }
  return (
    <ul className="divide-y divide-border-muted">
      {notices.map((n) => (
        <li key={n.id} className={`px-4 py-3 ${n.status === "sent" ? "bg-accent-muted/40" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <button onClick={() => { const next = open === n.id ? null : n.id; setOpen(next); if (next && n.status === "sent") mark(n.id, "read"); }} className={`text-left ${n.status === "sent" ? "font-semibold" : ""} text-accent hover:underline`}>{n.subject}</button>
            <span className="text-fg-muted">from {n.orgName} · {n.createdAt.slice(0, 16).replace("T", " ")}</span>
            <span className={`ml-auto label ${n.status === "acknowledged" ? "label-success" : n.status === "read" ? "label-muted" : "label-accent"}`}>{n.status}</span>
          </div>
          {open === n.id && (
            <div className="mt-2 rounded-md border border-border bg-canvas-subtle p-3">
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{n.body}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.status !== "acknowledged" && <button onClick={() => mark(n.id, "acknowledge")} disabled={busy === n.id} className="btn btn-sm btn-primary">{busy === n.id ? "…" : "Acknowledge receipt"}</button>}
                <a href={`/letter/${n.id}`} target="_blank" className="btn btn-sm">Open as letter</a>
                {n.handoverId && <a href={`#handover-${n.handoverId}`} className="btn btn-sm">Go to handover</a>}
              </div>
            </div>
          )}
        </li>
      ))}
      {notices.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-fg-muted">Your inbox is empty.</li>}
    </ul>
  );
}
