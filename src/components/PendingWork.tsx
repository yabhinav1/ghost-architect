"use client";

import { useState } from "react";
import { readiness, type PendingWork as Pending } from "@/lib/readiness";

/** What still dies with this person in this repo, plus a readiness score for the handover. */
export function PendingWork({ slug, login, repoUrl, files, quiz }: { slug: string; login: string; repoUrl: string; files: { done: boolean; notes: string }[]; quiz?: "passed" | "not passed" }) {
  const [data, setData] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  function load() {
    if (data || loading) return;
    setLoading(true);
    fetch(`/api/org/${slug}/pending?login=${encodeURIComponent(login)}&repo=${encodeURIComponent(repoUrl)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`); setData(d); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }
  const r = readiness(files, data, quiz);
  const tone = r.label === "ready" ? "label-success" : r.label === "nearly" ? "label-accent" : r.label === "in progress" ? "label-attention" : "label-danger";
  const total = data ? data.pullRequests.length + data.issues.length + data.branches.length + data.todos.length : null;
  return (
    <div className="border-t border-border-muted">
      <button onClick={() => { const next = !open; setOpen(next); if (next) load(); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] hover:bg-canvas-subtle">
        <span className={`label ${tone}`}>{r.label} · {r.score}</span>
        <span className="text-fg-muted">Work in flight{total !== null ? `: ${total} item${total === 1 ? "" : "s"}` : ""}</span>
        <span className="ml-auto text-fg-subtle">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-3 text-[12px]">
          {r.reasons.length > 0 && <p className="text-fg-muted">{r.reasons.join(" · ")}</p>}
          {loading && <p className="ghost-pulse text-fg-muted">Reading branches, blame, pull requests and issues…</p>}
          {error && <p className="text-danger">{error}</p>}
          {data && (
            <>
              <Block title="Open pull requests they authored" empty="none">{data.pullRequests.map((p) => <li key={p.url}><a href={p.url} target="_blank" className="text-accent hover:underline">#{p.number} {p.title}</a> <span className="text-fg-subtle">updated {p.updatedAt.slice(0, 10)}</span></li>)}</Block>
              <Block title="Open issues assigned to them" empty="none">{data.issues.map((p) => <li key={p.url}><a href={p.url} target="_blank" className="text-accent hover:underline">#{p.number} {p.title}</a> <span className="text-fg-subtle">updated {p.updatedAt.slice(0, 10)}</span></li>)}</Block>
              <Block title="Branches only they pushed, with unmerged commits" empty="none">{data.branches.map((b) => <li key={b.name}><span className="font-mono">{b.name}</span> <span className="label label-attention ml-1">{b.unmerged} unmerged</span> <span className="text-fg-subtle">last {b.lastCommit.slice(0, 10)}</span></li>)}</Block>
              <Block title="TODO / FIXME they wrote and never closed" empty="none">{data.todos.map((t) => <li key={`${t.file}:${t.line}`}><span className="font-mono text-fg-muted">{t.file}:{t.line}</span> {t.text} <span className="text-fg-subtle">{t.date}</span></li>)}</Block>
              {data.notes.map((n) => <p key={n} className="text-fg-subtle">{n}</p>)}
              <p className="text-fg-subtle">Computed {data.computedAt.slice(11, 16)} UTC. Pull requests and issues from GitHub; branches and TODOs from git blame on the clone.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div>
      <p className="font-semibold text-fg-muted">{title} <span className="counter ml-1">{children.length}</span></p>
      {children.length ? <ul className="mt-1 space-y-1">{children}</ul> : <p className="text-fg-subtle">{empty}</p>}
    </div>
  );
}
