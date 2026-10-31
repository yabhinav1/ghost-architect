"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Octicon } from "@/components/ui";
import type { PortfolioSummary } from "@/lib/insights";
import type { Repo } from "@/lib/types";

const MAX_SCAN = 6;
const MAX_KB = 150 * 1024;

export function Portfolio({ repos }: { repos: Repo[] }) {
  // Candidates: your own non-fork, non-archived repos, newest push first, small enough for the free box.
  const candidates = useMemo(() => repos.filter((r) => !r.fork && !r.archived && r.size <= MAX_KB).slice(0, MAX_SCAN), [repos]);
  const [summaries, setSummaries] = useState<Record<string, PortfolioSummary | null>>({});
  const [scanning, setScanning] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stop = useRef(false);

  const refresh = useCallback(async () => {
    if (!candidates.length) return;
    const res = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repos: candidates.map((r) => r.html_url) }) });
    if (res.ok) setSummaries(await res.json());
  }, [candidates]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function scan() {
    stop.current = false;
    const missing = candidates.filter((r) => !summaries[r.html_url]);
    for (const r of missing) {
      if (stop.current) break;
      setScanning(r.full_name);
      setProgress("starting");
      try {
        const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: r.html_url }) });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            if (msg.progress) setProgress(msg.progress.step + (msg.progress.total ? ` ${msg.progress.done}/${msg.progress.total}` : ""));
            if (msg.error) throw new Error(msg.error);
          }
        }
        await refresh();
      } catch (e) {
        setErrors((x) => ({ ...x, [r.html_url]: (e as Error).message }));
      }
    }
    setScanning(null);
  }

  const done = candidates.filter((r) => summaries[r.html_url]).length;
  const fragile = candidates.filter((r) => summaries[r.html_url]?.level === "fragile").length;

  if (!candidates.length) return null;

  return (
    <section className="card mb-5">
      <header className="card-header">
        <Octicon name="flame" className="h-4 w-4 text-fg-muted" />
        <span className="flex-1">Risk across your repositories</span>
        {done > 0 && <span className={`label ${fragile ? "label-danger" : "label-success"}`}>{fragile ? `${fragile} fragile` : "no fragile repos"}</span>}
        {done < candidates.length && (
          <button onClick={scanning ? () => { stop.current = true; } : scan} className={`btn btn-sm ${scanning ? "" : "btn-primary"}`}>
            {scanning ? "Stop" : `Scan ${candidates.length - done} repo${candidates.length - done > 1 ? "s" : ""}`}
          </button>
        )}
      </header>
      {scanning && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-[12px] text-fg-muted">
          <span className="ghost-pulse inline-block h-2 w-2 rounded-full bg-success" />
          Analysing <span className="font-mono text-fg">{scanning}</span> · {progress}
        </div>
      )}
      <ul className="grid gap-px bg-border-muted sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((r) => {
          const s = summaries[r.html_url];
          const err = errors[r.html_url];
          return (
            <li key={r.id} className="bg-canvas p-3">
              <div className="flex items-center gap-2">
                <Link href={`/r/${r.full_name}`} className="truncate text-[13px] font-semibold text-accent hover:underline">{r.name}</Link>
                {s && <span className={`label ml-auto ${s.level === "fragile" ? "label-danger" : s.level === "watch" ? "label-attention" : "label-success"}`}>{s.level}</span>}
                {!s && !err && <span className="label label-muted ml-auto">{scanning === r.full_name ? "scanning" : "not scanned"}</span>}
                {err && <span className="label label-danger ml-auto" title={err}>failed</span>}
              </div>
              {s ? (
                <>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <Tile label="Bus factor" value={String(s.busFactor)} bad={s.busFactor <= 1} />
                    <Tile label="Top owner" value={`${Math.round(s.topShare * 100)}%`} bad={s.topShare >= 0.6} hint={s.topAuthor.split(" ")[0]} />
                    <Tile label="Fragile files" value={String(s.fragileFiles)} bad={s.fragileFiles > 5} hint="single owner, active" />
                  </dl>
                  {s.reddest && <p className="mt-2 truncate font-mono text-[11px] text-fg-muted" title={s.reddest}>riskiest: {s.reddest}</p>}
                </>
              ) : (
                <p className="mt-2 text-[12px] text-fg-muted">{err ?? r.description ?? "No analysis yet."}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="px-4 py-2 text-[11px] text-fg-subtle">Bus factor = people covering half the code. Fragile = one person owns 90%+ of a file that changed this year. Scans your {MAX_SCAN} most recently pushed non-fork repos under {MAX_KB / 1024} MB.</p>
    </section>
  );
}

function Tile({ label, value, bad, hint }: { label: string; value: string; bad: boolean; hint?: string }) {
  return (
    <div className="rounded-md border border-border-muted bg-canvas-subtle p-1.5">
      <dt className="text-[10px] text-fg-muted">{label}</dt>
      <dd className={`text-lg font-semibold leading-tight ${bad ? "text-danger" : ""}`}>{value}</dd>
      {hint && <dd className="truncate text-[10px] text-fg-subtle">{hint}</dd>}
    </div>
  );
}
