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
    s === "documented" ? "bg-emerald-900 text-emerald-200" : s === "inferred" ? "bg-amber-900 text-amber-200" : "bg-zinc-800 text-zinc-300";

  return (
    <div className="mt-4 border-t border-zinc-800 pt-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Ask the ghost</p>
      <div className="space-y-2">
        {log.map((e, i) => (
          <div key={i} className="text-xs">
            <p className="text-zinc-400">› {e.q}</p>
            {e.a && (
              <p className="mt-0.5 leading-relaxed text-zinc-200">
                <span className={`mr-1 rounded px-1 text-[10px] ${tag(e.a.status)}`}>{e.a.status.replace("_", " ")}</span>
                {e.a.answer}
                {e.a.evidenceItems.map((ev) => (
                  <a key={ev.id} href={ev.url} target="_blank" title={ev.title} className="ml-1 rounded bg-zinc-800 px-1 text-[10px] text-sky-300 hover:bg-zinc-700">{ev.id}</a>
                ))}
              </p>
            )}
            {e.error && <p className="mt-0.5 text-red-300">{e.error}</p>}
            {!e.a && !e.error && <p className="mt-0.5 animate-pulse text-zinc-500">reading the history…</p>}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-2 flex gap-1">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why does this retry three times?" className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-black disabled:opacity-40">Ask</button>
      </form>
      <p className="mt-1 text-[10px] text-zinc-600">Answers only from commits and PRs for this file. If nothing explains it, it says so.</p>
    </div>
  );
}
