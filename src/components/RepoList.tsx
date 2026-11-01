"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { LANGUAGE_COLORS, relativeTime } from "@/lib/format";
import { Octicon } from "@/components/ui";
import type { Repo } from "@/lib/types";

type Sort = "pushed" | "name" | "stars";

/** Repositories are shown in visibility sections so private and public work never mix on screen. */
const GROUPS: { key: string; title: string; hint: string; labelClass: string; pick: (r: Repo) => boolean }[] = [
  { key: "private", title: "Private", hint: "only accounts with access can analyse these; never shared", labelClass: "label-attention", pick: (r) => r.private && !r.archived },
  { key: "public", title: "Public", hint: "anyone can analyse these", labelClass: "label-success", pick: (r) => !r.private && !r.fork && !r.archived },
  { key: "forks", title: "Forks", hint: "copies of other people's repositories", labelClass: "label-muted", pick: (r) => !r.private && r.fork && !r.archived },
  { key: "archived", title: "Archived", hint: "read-only on GitHub", labelClass: "label-muted", pick: (r) => r.archived },
];
type Filter = "all" | "private" | "public" | "sources" | "forks";

export function RepoList({ repos }: { repos: Repo[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("pushed");
  const [filter, setFilter] = useState<Filter>("all");
  const [lang, setLang] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [goingTo, setGoingTo] = useState<string | null>(null);
  const router = useRouter();
  const dq = useDeferredValue(q.trim().toLowerCase());

  const languages = useMemo(() => [...new Set(repos.map((r) => r.language).filter((l): l is string => Boolean(l)))].sort(), [repos]);

  const shown = useMemo(() => {
    let list = repos;
    if (filter === "private") list = list.filter((r) => r.private);
    if (filter === "public") list = list.filter((r) => !r.private);
    if (filter === "sources") list = list.filter((r) => !r.fork);
    if (filter === "forks") list = list.filter((r) => r.fork);
    if (lang) list = list.filter((r) => r.language === lang);
    if (dq) list = list.filter((r) => r.full_name.toLowerCase().includes(dq) || (r.description ?? "").toLowerCase().includes(dq));
    return [...list].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "stars" ? b.stargazers_count - a.stargazers_count : b.pushed_at.localeCompare(a.pushed_at),
    );
  }, [repos, filter, lang, dq, sort]);

  function go(r: Repo) {
    setGoingTo(r.full_name);
    startTransition(() => router.push(`/r/${r.full_name}`));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[200px] flex-1 sm:w-auto">
          <Octicon name="search" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-fg-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-8" placeholder="Find a repository…" autoFocus />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="input w-auto">
          <option value="all">Type: All</option>
          <option value="sources">Sources</option>
          <option value="forks">Forks</option>
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="input w-auto">
          <option value="">Language: All</option>
          {languages.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto">
          <option value="pushed">Sort: Last pushed</option>
          <option value="name">Name</option>
          <option value="stars">Stars</option>
        </select>
      </div>
      <p className="mt-2 text-[12px] text-fg-muted"><b className="text-fg">{shown.length}</b> of {repos.length} repositories</p>

      {GROUPS.map((g) => {
        const items = shown.filter(g.pick);
        if (!items.length) return null;
        return (
          <section key={g.key} className="card mt-3">
            <div className="card-header">
              <span className={`label ${g.labelClass}`}>{g.title}</span>
              <span className="counter">{items.length}</span>
              <span className="ml-2 text-[12px] font-normal text-fg-muted">{g.hint}</span>
            </div>
            <ul className="stagger divide-y divide-border-muted">
              {items.map((r) => (
                <li key={r.id} className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-canvas-subtle/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/r/${r.full_name}`} prefetch className="truncate text-[15px] font-semibold text-accent hover:underline" onClick={(e) => { e.preventDefault(); go(r); }}>
                        {r.owner.login !== r.full_name.split("/")[0] ? r.full_name : r.name}
                      </Link>
                      {r.fork && <span className="label label-muted">Fork</span>}
                      {r.archived && <span className="label label-attention">Archived</span>}
                    </div>
                    {r.description && <p className="mt-0.5 line-clamp-1 text-[13px] text-fg-muted">{r.description}</p>}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-muted">
                      {r.language && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: LANGUAGE_COLORS[r.language] ?? "#8b949e" }} />{r.language}</span>}
                      {r.stargazers_count > 0 && <span>★ {r.stargazers_count}</span>}
                      {r.forks_count > 0 && <span>⑂ {r.forks_count}</span>}
                      <span>Updated {relativeTime(r.pushed_at)}</span>
                    </p>
                  </div>
                  <button onClick={() => go(r)} disabled={pending && goingTo === r.full_name} className="btn btn-sm shrink-0 self-center">
                    <Octicon name="ghost" className="h-3.5 w-3.5" />
                    {pending && goingTo === r.full_name ? "Opening…" : "Analyse"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {shown.length === 0 && <div className="card mt-3"><div className="blankslate"><h3>No repositories match</h3><p>Try a different search or filter.</p></div></div>}
    </div>
  );
}
