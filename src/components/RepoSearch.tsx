"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Octicon } from "@/components/ui";
import { LANGUAGE_COLORS, relativeTime } from "@/lib/format";
import { buildIndex, search } from "@/lib/vectors";
import type { Repo } from "@/lib/types";

const SUGGESTIONS = ["private", "public stale", "fork", "typescript api", "archived"];

/** Vector search across the account's repositories with public/private classification. */
export function RepoSearch({ repos }: { repos: Repo[] }) {
  const index = useMemo(() => buildIndex(repos), [repos]);
  const [q, setQ] = useState("");
  const result = useMemo(() => (q.trim() ? search(index, q) : null), [index, q]);
  const counts = useMemo(() => ({ public: repos.filter((r) => !r.private).length, private: repos.filter((r) => r.private).length, forks: repos.filter((r) => r.fork).length, archived: repos.filter((r) => r.archived).length }), [repos]);
  return (
    <section className="card">
      <div className="card-header"><Octicon name="search" className="h-4 w-4 text-fg-muted" />Vector search <span className="ml-2 font-normal text-fg-muted">TF-IDF over names, descriptions, languages and visibility</span></div>
      <div className="p-3">
        <div className="relative">
          <Octicon name="search" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-8" placeholder='Try "private payments", "stale python", "public api"…' />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
          <span className="label label-success">{counts.public} public</span>
          <span className="label label-attention">{counts.private} private</span>
          <span className="label label-muted">{counts.forks} forks</span>
          <span className="label label-muted">{counts.archived} archived</span>
          <span className="mx-1">·</span>
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => setQ(s)} className="btn btn-sm !rounded-full !py-0 !text-[11px]">{s}</button>)}
        </div>
        {result && (
          <ul className="mt-3 divide-y divide-border-muted border-t border-border-muted">
            {result.filters.length > 0 && <li className="py-1.5 text-[11px] text-fg-subtle">Filtering by class: {result.filters.join(", ")}</li>}
            {result.hits.map((h) => (
              <li key={h.repo.id} className="flex items-center gap-3 py-2">
                <span className={`label ${h.repo.private ? "label-attention" : "label-success"}`}>{h.repo.private ? "private" : "public"}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/r/${h.repo.full_name}`} className="text-[13px] font-semibold text-accent hover:underline">{h.repo.name}</Link>
                  <span className="ml-2 text-[11px] text-fg-muted">{h.repo.language && <><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: LANGUAGE_COLORS[h.repo.language] ?? "#8b949e" }} />{h.repo.language} · </>}updated {relativeTime(h.repo.pushed_at)}{h.classes.includes("stale") ? " · stale" : ""}{h.repo.fork ? " · fork" : ""}</span>
                  {h.repo.description && <p className="truncate text-[12px] text-fg-muted">{h.repo.description}</p>}
                </div>
                <span className="text-[11px] text-fg-subtle" title={`matched: ${h.matched.join(", ") || "class filter"}`}>{(h.score * 100).toFixed(0)}%</span>
              </li>
            ))}
            {result.hits.length === 0 && <li className="py-4 text-center text-[12px] text-fg-muted">Nothing matches.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
