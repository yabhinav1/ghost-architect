"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui";
import type { ActivityEvent } from "@/lib/org";

export function ActivityTable({ events }: { events: ActivityEvent[] }) {
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");
  const people = useMemo(() => {
    const m = new Map<string, { name: string; count: number; member: boolean }>();
    for (const e of events) {
      const k = e.member ? `@${e.member.login}` : e.email;
      const cur = m.get(k) ?? { name: e.member?.name ?? e.name, count: 0, member: Boolean(e.member) };
      cur.count++;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [events]);
  const shown = events.filter((e) => (!who || (e.member ? `@${e.member.login}` : e.email) === who) && (!q || `${e.subject} ${e.slug} ${e.name} ${e.email}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <select value={who} onChange={(e) => setWho(e.target.value)} className="input w-auto text-[12px]">
          <option value="">Everyone ({events.length})</option>
          {people.map(([k, v]) => <option key={k} value={k}>{v.name} {v.member ? k : `(${k}, not a member)`} · {v.count}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input w-64 text-[12px]" placeholder="Search commits…" />
        <span className="ml-auto text-[11px] text-fg-subtle">{shown.length} commits</span>
      </div>
      <table className="w-full text-[12px]">
        <thead><tr className="border-y border-border-muted text-left text-fg-muted"><th className="px-4 py-1.5 font-medium">When</th><th className="py-1.5 font-medium">Who</th><th className="py-1.5 font-medium">Email</th><th className="py-1.5 font-medium">Repository</th><th className="py-1.5 font-medium">Commit</th><th className="py-1.5 pr-4 text-right font-medium">Files</th></tr></thead>
        <tbody>
          {shown.slice(0, 300).map((e, i) => (
            <tr key={`${e.sha}-${i}`} className="border-b border-border-muted hover:bg-canvas-subtle/60">
              <td className="whitespace-nowrap px-4 py-1.5 text-fg-muted">{e.date.slice(0, 16).replace("T", " ")}</td>
              <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><Avatar name={e.member?.name ?? e.name} email={e.email} size={18} />{e.member ? <span>{e.member.name} <span className="text-fg-muted">@{e.member.login}</span></span> : <span className="text-fg-muted">{e.name} <span className="label label-attention ml-1">not a member</span></span>}</span></td>
              <td className="py-1.5 font-mono text-[11px] text-fg-muted">{e.email}</td>
              <td className="py-1.5"><a href={`/r/${e.slug}`} className="text-accent hover:underline">{e.slug}</a></td>
              <td className="max-w-[360px] truncate py-1.5" title={e.subject}><a href={`${e.repoUrl}/commit/${e.sha}`} target="_blank" className="font-mono text-[11px] text-fg-muted">{e.sha}</a> {e.subject}</td>
              <td className="py-1.5 pr-4 text-right text-fg-muted">{e.files}</td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-fg-muted">No commits match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
