"use client";

import { useState } from "react";
import type { AskResult, Evidence } from "@/lib/types";

type Answer = AskResult & { evidenceItems: Evidence[] };

export function AskGhost({ repoUrl, file }: { repoUrl: string; file: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; a?: Answer; error?: string }[]>([]);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setQ("");
    setLog((l) => [...l, { q: question }]);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, file, question }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ask failed");
      setLog((l) => l.map((e, i) => (i === l.length - 1 ? { ...e, a: data } : e)));
    } catch (e) {
      setLog((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  }

  const tag = (s: AskResult["status"]) =>
    s === "documented" ? "label label-success" : s === "inferred" ? "label label-attention" : "label label-muted";

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-1.5 text-[12px] font-semibold text-fg-muted">Ask the ghost</p>
      <div className="space-y-2">
        {log.map((e, i) => (
          <div key={i} className="text-xs">
            <p className="text-fg-muted">› {e.q}</p>
            {e.a && (
              <p className="mt-0.5 leading-relaxed text-fg">
                <span className={`mr-1 ${tag(e.a.status)}`}>{e.a.status.replace("_", " ")}</span>
                {e.a.answer}
                {e.a.evidenceItems.map((ev) => (
                  <a key={ev.id} href={ev.url} target="_blank" title={ev.title} className="label label-accent ml-1 hover:underline">{ev.id}</a>
                ))}
              </p>
            )}
            {e.error && <p className="mt-0.5 text-danger">{e.error}</p>}
            {!e.a && !e.error && <p className="ghost-pulse mt-0.5 text-fg-muted">reading the history…</p>}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-2 flex gap-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why does this retry three times?" className="input min-w-0 flex-1 text-[12px]" />
        <button type="submit" disabled={busy || !q.trim()} className="btn btn-sm">Ask</button>
      </form>
      <p className="mt-1 text-[10px] text-fg-subtle">Answers only from commits and PRs for this file. If nothing explains it, it says so.</p>
    </div>
  );
}
