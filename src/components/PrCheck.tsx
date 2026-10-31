"use client";

import { useMemo, useState } from "react";
import { Avatar, Card, Octicon } from "@/components/ui";
import { suggestReceiver } from "@/lib/insights";
import { scoreColor } from "@/lib/score";
import type { Analysis, Scored } from "@/lib/types";
import type { PrInfo } from "@/app/api/pr-check/route";

const RISKY = 40;

export function PrCheck({ repoUrl, analysis, scored, departed, onSelect }: { repoUrl: string; analysis: Analysis; scored: Scored[]; departed: Set<string>; onSelect: (path: string) => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pr, setPr] = useState<PrInfo | null>(null);
  const byPath = useMemo(() => new Map(scored.map((f) => [f.path, f])), [scored]);

  async function check() {
    const v = input.trim();
    if (!v || busy) return;
    setBusy(true);
    setError(null);
    setPr(null);
    try {
      const res = await fetch("/api/pr-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, pr: v }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setPr(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    if (!pr) return [];
    return pr.files
      .map((f) => ({ ...f, scored: byPath.get(f.path) ?? null }))
      .sort((a, b) => (b.scored?.score ?? -1) - (a.scored?.score ?? -1));
  }, [pr, byPath]);
  const risky = rows.filter((r) => (r.scored?.score ?? 0) >= RISKY);
  const unknown = rows.filter((r) => !r.scored).length;
  const verdict = risky.length === 0 ? "clear" : risky.length <= 2 ? "review" : "high";

  return (
    <Card
      title={<span className="flex items-center gap-2"><Octicon name="check" className="h-4 w-4 text-fg-muted" />PR risk check</span>}
      right={pr ? <span className={`label ${verdict === "clear" ? "label-success" : verdict === "review" ? "label-attention" : "label-danger"}`}>{verdict === "clear" ? "no orphaned files touched" : verdict === "review" ? `${risky.length} orphaned file${risky.length > 1 ? "s" : ""} touched` : `${risky.length} orphaned files touched`}</span> : undefined}
    >
      <div className="p-3">
        <form onSubmit={(e) => { e.preventDefault(); check(); }} className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="input flex-1 font-mono text-[13px]" placeholder="PR number or link, e.g. 5432" />
          <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary">{busy ? "Checking…" : "Check"}</button>
        </form>
        <p className="mt-1.5 text-[11px] text-fg-subtle">Which files in this pull request were written by people who left, and who should review them instead.{departed.size === 0 ? " Mark someone as departed first, or every file reads as safe." : ""}</p>
        {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

        {pr && (
          <div className="mt-3">
            <p className="text-[13px]">
              <a href={pr.url} target="_blank" className="font-semibold text-accent hover:underline">#{pr.number} {pr.title}</a>
              <span className="ml-2 text-fg-muted">by {pr.author} · {pr.state} · {pr.files.length} file{pr.files.length !== 1 ? "s" : ""}{pr.truncated ? "+" : ""}</span>
            </p>
            {risky.length > 0 && (
              <p className="mt-1 text-[12px] text-fg-muted">
                {risky.length} of them score {RISKY}+ for orphaned criticality. Ask the suggested reviewer to look, and open the brief before merging.
              </p>
            )}
            <ul className="mt-2 divide-y divide-border-muted border-t border-border-muted">
              {rows.slice(0, 25).map((r) => {
                const s = r.scored;
                const receiver = s ? suggestReceiver(s, departed, analysis.authors) : null;
                return (
                  <li key={r.path} className="flex items-center gap-2 py-1.5 text-[12px]">
                    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s ? scoreColor(s.score) : "#21262d" }} />
                    {s ? (
                      <button onClick={() => onSelect(r.path)} className="truncate font-mono text-accent hover:underline">{r.path}</button>
                    ) : (
                      <span className="truncate font-mono text-fg-muted" title="not in the analysed set (new, deleted, or not source)">{r.path}</span>
                    )}
                    <span className="shrink-0 text-fg-subtle">+{r.additions} −{r.deletions}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {s && s.score >= RISKY && receiver && (
                        <span className="inline-flex items-center gap-1 text-fg-muted" title={`suggested reviewer: ${receiver.email}`}>
                          <Avatar name={receiver.name} email={receiver.email} size={16} />{receiver.name.split(" ")[0]}
                        </span>
                      )}
                      {s && s.score >= RISKY && !receiver && <span className="label label-danger">nobody left</span>}
                      {s && <span className="counter">{s.score}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {rows.length > 25 && <p className="mt-1 text-[11px] text-fg-subtle">Showing the 25 riskiest of {rows.length} files.</p>}
            {unknown > 0 && <p className="mt-1 text-[11px] text-fg-subtle">{unknown} file{unknown > 1 ? "s" : ""} not in the analysed set (new files, deletions, or non-source).</p>}
          </div>
        )}
      </div>
    </Card>
  );
}
