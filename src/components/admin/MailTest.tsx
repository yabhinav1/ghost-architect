"use client";

import { useState } from "react";

/** Admin control: prove SMTP end to end by sending a test message. */
export function MailTest({ status, defaultTo }: { status: string; defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function send() {
    setBusy(true); setOut(null);
    try {
      const r = await fetch("/api/admin/mail-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setOut(d.result.sent ? `Sent to ${d.to}. Check the inbox (and spam).` : `Not sent: ${d.result.error ?? d.verify.error ?? "unknown"}`);
    } catch (e) { setOut((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <li className="px-4 py-2">
      <div className="flex items-center justify-between"><span>Email (SMTP)</span><span className={`label ${status === "smtp" || status === "brevo" ? "label-success" : status === "outbox" ? "label-muted" : "label-danger"}`}>{status}</span></div>
      <div className="mt-2 flex gap-2">
        <input value={to} onChange={(e) => setTo(e.target.value)} className="input flex-1 text-[12px]" placeholder="you@example.com" />
        <button onClick={send} disabled={busy || !to} className="btn btn-sm">{busy ? "Sending…" : "Send test"}</button>
      </div>
      {out && <p className={`mt-1 text-[11px] ${out.startsWith("Sent") ? "text-success" : "text-danger"}`}>{out}</p>}
    </li>
  );
}
