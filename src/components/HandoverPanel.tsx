"use client";

import { useMemo, useState } from "react";
import { handoverPlan } from "@/lib/insights";
import { scoreColor } from "@/lib/score";
import type { Analysis, BriefResult } from "@/lib/types";

type Props = {
  analysis: Analysis;
  repoUrl: string;
  email: string;
  lastDay: string;
  extraDeparted: Set<string>;
  onSelect: (path: string) => void;
};

export function HandoverPanel({ analysis, repoUrl, email, lastDay, extraDeparted, onSelect }: Props) {
  const plan = useMemo(() => handoverPlan(analysis, email, extraDeparted), [analysis, email, extraDeparted]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [briefs, setBriefs] = useState<Record<string, BriefResult | { error: string }>>({});
  const [running, setRunning] = useState<string | null>(null);

  const top = plan.slice(0, 15);
  const coverage = top.length ? Math.round((top.filter((i) => done.has(i.file.path)).length / top.length) * 100) : 0;
  const daysLeft = lastDay ? Math.ceil((Date.parse(lastDay) - Date.now()) / 86400000) : null;
  const name = analysis.authors[email]?.name ?? email;
  const orphanedNoReceiver = top.filter((i) => !i.receiver).length;

  async function generateBriefs() {
    const files = top.slice(0, 10).map((i) => i.file.path).filter((p) => !briefs[p] || "error" in briefs[p]);
    if (!files.length) return;
    setRunning(files[0]);
    try {
      const res = await fetch("/api/explain-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, files, departed: [email, ...extraDeparted] }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { file: string; result?: BriefResult; error?: string };
          setBriefs((b) => ({ ...b, [msg.file]: msg.result ?? { error: msg.error ?? "failed" } }));
          const idx = files.indexOf(msg.file);
          setRunning(files[idx + 1] ?? null);
        }
      }
    } catch (e) {
      setBriefs((b) => ({ ...b, [files[0]]: { error: (e as Error).message } }));
    } finally {
      setRunning(null);
    }
  }

  if (plan.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
        No analysed file has commits or blame lines from <span className="font-mono text-zinc-200">{email}</span>. Check the email matches their git identity, or pick one from the author list after analysing.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">Handover plan for {name}</p>
          <p className="text-xs text-zinc-500">{plan.length} files touched · top {top.length} shown · {orphanedNoReceiver > 0 ? `${orphanedNoReceiver} with nobody left to take them` : "every file has a receiver"}</p>
        </div>
        {daysLeft !== null && (
          <div className="text-right">
            <p className={`text-2xl font-semibold ${daysLeft <= 14 ? "text-red-400" : daysLeft <= 30 ? "text-amber-300" : "text-zinc-100"}`}>{daysLeft < 0 ? 0 : daysLeft}</p>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">days left</p>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>KT coverage</span>
          <span className={coverage === 100 ? "text-emerald-400" : ""}>{coverage}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
          <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${coverage}%` }} />
        </div>
      </div>

      <button onClick={generateBriefs} disabled={running !== null} className="mt-3 w-full rounded bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50">
        {running ? `Writing brief for ${running.split("/").pop()}…` : "Generate briefs for the top 10"}
      </button>

      <ol className="mt-3 space-y-2">
        {top.map(({ file, receiver }) => {
          const b = briefs[file.path];
          const ticked = done.has(file.path);
          return (
            <li key={file.path} className={`rounded border p-2 ${ticked ? "border-emerald-900/60 bg-emerald-950/20" : "border-zinc-800"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={ticked} onChange={() => setDone((s) => { const n = new Set(s); if (n.has(file.path)) n.delete(file.path); else n.add(file.path); return n; })} className="mt-0.5 accent-emerald-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: scoreColor(file.score) }} />
                    <button onClick={() => onSelect(file.path)} className={`truncate text-left font-mono text-xs hover:text-white ${ticked ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{file.path}</button>
                    <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{file.score}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {Math.round(((file.authors[email] ?? 0) / file.lines) * 100)}% their lines · {file.commitAuthors?.[email] ?? 0} of {file.commits24m} recent commits ·{" "}
                    {receiver ? (
                      <>hand to <span className="text-zinc-300">{receiver.name}</span> ({Math.round((receiver.lines / file.lines) * 100)}%)</>
                    ) : (
                      <span className="text-red-300">no remaining author, needs a volunteer</span>
                    )}
                  </p>
                  {b && "brief" in b && <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-zinc-300">{b.brief.purpose}</p>}
                  {b && "error" in b && <p className="mt-1 text-[11px] text-red-300">{b.error}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[10px] text-zinc-600">Tick a file once the receiver has walked through it with {name.split(" ")[0]}. Briefs are saved and appear in the report.</p>
    </div>
  );
}
