"use client";

import { useMemo, useState } from "react";
import { handoverPlan } from "@/lib/insights";
import { scoreColor } from "@/lib/score";
import { Avatar, Card, Octicon } from "@/components/ui";
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
      <Card title="Handover plan">
        <div className="blankslate !py-8 text-[13px]">
          <p>No analysed file has commits or blame lines from <span className="font-mono text-fg">{email}</span>.</p>
          <p className="mt-1">Check it matches their git identity, or pick one of the top owners.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={<span className="flex items-center gap-2"><Avatar name={name} email={email} size={20} gone /><span>Handover plan for {name}</span></span>}
      right={daysLeft !== null ? <span className={`label ${daysLeft <= 14 ? "label-danger" : daysLeft <= 30 ? "label-attention" : "label-muted"}`}><Octicon name="clock" className="mr-1 h-3 w-3" />{daysLeft < 0 ? 0 : daysLeft} days left</span> : undefined}
    >
      <div className="border-b border-border px-3 py-2 text-[12px] text-fg-muted">
        {plan.length} files touched · top {top.length} shown · {orphanedNoReceiver > 0 ? <span className="text-danger">{orphanedNoReceiver} with nobody left to take them</span> : "every file has a receiver"}
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-fg-muted">KT coverage</span>
          <span className={coverage === 100 ? "text-success" : "text-fg"}>{coverage}%</span>
        </div>
        <div className="progress mt-1.5"><span style={{ width: `${coverage}%` }} /></div>
        <button onClick={generateBriefs} disabled={running !== null} className="btn btn-primary mt-3 w-full justify-center">
          <Octicon name="ghost" className="h-4 w-4" />
          {running ? `Writing brief for ${running.split("/").pop()}…` : "Generate briefs for the top 10"}
        </button>
      </div>

      <ol className="mt-3 divide-y divide-border-muted border-t border-border-muted">
        {top.map(({ file, receiver }) => {
          const b = briefs[file.path];
          const ticked = done.has(file.path);
          return (
            <li key={file.path} className={`px-3 py-2 ${ticked ? "bg-success-muted" : "hover:bg-canvas-subtle"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" className="check mt-1" checked={ticked} onChange={() => setDone((s) => { const n = new Set(s); if (n.has(file.path)) n.delete(file.path); else n.add(file.path); return n; })} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: scoreColor(file.score) }} />
                    <button onClick={() => onSelect(file.path)} className={`truncate text-left font-mono text-[12px] hover:underline ${ticked ? "text-fg-muted line-through" : "text-accent"}`}>{file.path}</button>
                    <span className="counter ml-auto">{file.score}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] text-fg-muted">
                    <span>{Math.round(((file.authors[email] ?? 0) / file.lines) * 100)}% their lines · {file.commitAuthors?.[email] ?? 0} of {file.commits24m} recent commits ·</span>
                    {receiver ? (
                      <span className="inline-flex items-center gap-1">hand to <Avatar name={receiver.name} email={receiver.email} size={14} /><b className="text-fg">{receiver.name}</b> ({Math.round((receiver.lines / file.lines) * 100)}%)</span>
                    ) : (
                      <span className="label label-danger">no remaining author</span>
                    )}
                  </p>
                  {b && "brief" in b && <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-fg">{b.brief.purpose}</p>}
                  {b && "error" in b && <p className="mt-1 text-[11px] text-danger">{b.error}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="px-3 py-2 text-[10px] text-fg-subtle">Tick a file once the receiver has walked through it with {name.split(" ")[0]}. Briefs are saved and appear in the report.</p>
    </Card>
  );
}
