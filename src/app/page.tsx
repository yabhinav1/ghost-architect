"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AskGhost } from "@/components/AskGhost";
import { DecayChart } from "@/components/DecayChart";
import { HandoverPanel } from "@/components/HandoverPanel";
import { Treemap } from "@/components/Treemap";
import { codeownersText, scoreFilesAt } from "@/lib/insights";
import { scoreColor, scoreFiles } from "@/lib/score";
import type { Analysis, Brief, BriefResult, Evidence, Progress, Scored } from "@/lib/types";

type Mode = "layoffs" | "notice";
const MONTHS_BACK = 30;

const SAMPLE_REPOS = ["https://github.com/expressjs/express", "https://github.com/pallets/flask", "https://github.com/axios/axios"];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function parseDeparted(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState(SAMPLE_REPOS[0]);
  const [departedText, setDepartedText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResult | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [stillHere, setStillHere] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("layoffs");
  const [noticeEmail, setNoticeEmail] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [monthsAgo, setMonthsAgo] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  const departed = useMemo(() => {
    const set = mode === "notice" ? new Set(parseDeparted(noticeEmail)) : new Set(parseDeparted(departedText));
    for (const s of stillHere) set.delete(s);
    return set;
  }, [mode, noticeEmail, departedText, stillHere]);

  const asOf = useMemo(() => (monthsAgo > 0 ? new Date(Date.now() - monthsAgo * 30.44 * 86400000) : null), [monthsAgo]);
  const scored: Scored[] = useMemo(() => {
    if (!analysis) return [];
    return asOf ? scoreFilesAt(analysis.files, departed, asOf) : scoreFiles(analysis.files, departed);
  }, [analysis, departed, asOf]);

  // Share links: /?repo=…&departed=a,b&mode=notice&email=…&lastDay=…
  useEffect(() => {
    if (autoRan.current) return;
    const p = new URLSearchParams(window.location.search);
    const repo = p.get("repo");
    if (!repo) return;
    autoRan.current = true;
    // Deferred so the URL-driven state lands after hydration, then the analyse button is clicked.
    const t = setTimeout(() => {
      setRepoUrl(repo);
      if (p.get("departed")) setDepartedText(p.get("departed")!.split(",").join("\n"));
      if (p.get("mode") === "notice") setMode("notice");
      if (p.get("email")) setNoticeEmail(p.get("email")!);
      if (p.get("lastDay")) setLastDay(p.get("lastDay")!);
      setTimeout(() => document.getElementById("analyse-btn")?.click(), 0);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function shareUrl() {
    const p = new URLSearchParams({ repo: repoUrl });
    if (mode === "notice") {
      p.set("mode", "notice");
      if (noticeEmail) p.set("email", noticeEmail);
      if (lastDay) p.set("lastDay", lastDay);
    } else if (departed.size) p.set("departed", [...departed].join(","));
    return `${window.location.origin}/?${p.toString()}`;
  }

  async function copyShare() {
    await navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadCodeowners() {
    if (!analysis) return;
    const text = codeownersText(scoreFiles(analysis.files, departed), departed, analysis.authors);
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "CODEOWNERS";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const departedForCharts = useMemo(() => [...departed].slice(0, 3), [departed]);
  const selectedFile = scored.find((f) => f.path === selected) ?? null;
  const redCount = scored.filter((f) => f.score >= 60).length;
  const orphanedLines = scored.reduce((s, f) => s + f.departedLines, 0);
  const totalLines = scored.reduce((s, f) => s + f.lines, 0);

  async function analyze(force = false) {
    setLoading(true);
    setError(null);
    setBrief(null);
    setSelected(null);
    setProgress({ step: "Starting" });
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, force }) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result: Analysis | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.progress) setProgress(msg.progress);
          if (msg.error) throw new Error(msg.error);
          if (msg.result) result = msg.result;
        }
      }
      if (!result) throw new Error("Server closed the stream without a result");
      setAnalysis(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function explain(file: string) {
    setBriefLoading(true);
    setBriefError(null);
    setBrief(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, file, departed: [...departed] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Explain failed");
      setBrief(data);
    } catch (e) {
      setBriefError((e as Error).message);
    } finally {
      setBriefLoading(false);
    }
  }

  function pickTopAuthors(n: number) {
    if (!analysis) return;
    const top = Object.entries(analysis.authors)
      .sort((a, b) => b[1].lines - a[1].lines)
      .slice(0, n)
      .map(([email]) => email);
    setDepartedText(top.join("\n"));
    setStillHere(new Set());
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const emails = parseDeparted(text);
    setDepartedText(emails.join("\n"));
    setStillHere(new Set());
    if (fileInput.current) fileInput.current.value = "";
  }

  const reportHref = analysis ? `/report?repo=${encodeURIComponent(repoUrl)}&departed=${encodeURIComponent([...departed].join(","))}` : "#";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            Ghost-Architect <span className="ml-2 text-sm font-normal text-zinc-500">bus-factor radar for codebases that lost their authors</span>
          </h1>
          {analysis && (
            <div className="flex items-center gap-3 text-sm">
              <button onClick={copyShare} className="text-zinc-400 underline hover:text-white">{copied ? "Link copied" : "Copy share link"}</button>
              <button onClick={downloadCodeowners} disabled={departed.size === 0} title="Proposes a still-here owner for every risky file" className="text-zinc-400 underline hover:text-white disabled:opacity-40 disabled:no-underline">Download CODEOWNERS</button>
              <a href={reportHref} target="_blank" className="text-zinc-400 underline hover:text-white">Open report</a>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 inline-flex rounded-lg border border-zinc-800 p-0.5 text-sm">
          {(["notice", "layoffs"] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setStillHere(new Set()); setSelected(null); }} className={`rounded-md px-3 py-1 ${mode === m ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-white"}`}>
              {m === "notice" ? "Notice period" : "Layoffs"}
            </button>
          ))}
          <span className="self-center pl-3 pr-2 text-xs text-zinc-500">{mode === "notice" ? "one engineer is leaving: plan the handover" : "many left at once: see the blast radius"}</span>
        </div>
        <section className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Public GitHub repo</span>
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm" placeholder="https://github.com/org/repo" />
            <span className="flex flex-wrap gap-2 pt-1">
              {SAMPLE_REPOS.map((r) => (
                <button key={r} onClick={() => setRepoUrl(r)} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700">
                  {r.replace("https://github.com/", "")}
                </button>
              ))}
            </span>
          </label>
          {mode === "notice" ? (
            <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400">Who is leaving (git email)</span>
                <input value={noticeEmail} onChange={(e) => { setNoticeEmail(e.target.value); setStillHere(new Set()); }} list="author-list" className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm" placeholder="alice@company.com" />
                {analysis && (
                  <datalist id="author-list">
                    {Object.entries(analysis.authors).sort((a, b) => b[1].lines - a[1].lines).slice(0, 40).map(([email, a]) => <option key={email} value={email}>{a.name}</option>)}
                  </datalist>
                )}
                {analysis && !noticeEmail && (
                  <span className="flex flex-wrap gap-1 pt-1 text-xs text-zinc-500">
                    try:
                    {Object.entries(analysis.authors).sort((a, b) => b[1].lines - a[1].lines).slice(0, 3).map(([email, a]) => (
                      <button key={email} onClick={() => setNoticeEmail(email)} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 hover:bg-zinc-700">{a.name}</button>
                    ))}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400">Last day</span>
                <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
              </label>
            </div>
          ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between text-zinc-400">
              Departed engineers (emails, any format)
              <button type="button" onClick={() => fileInput.current?.click()} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700">
                upload CSV
              </button>
              <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onCsv} />
            </span>
            <textarea value={departedText} onChange={(e) => { setDepartedText(e.target.value); setStillHere(new Set()); }} rows={3} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs" placeholder="alice@company.com&#10;bob@company.com" />
            {analysis && (
              <span className="flex flex-wrap gap-2 pt-1 text-xs text-zinc-400">
                Simulate layoffs:
                {[1, 3, 5].map((n) => (
                  <button key={n} onClick={() => pickTopAuthors(n)} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 hover:bg-zinc-700">
                    top {n} author{n > 1 ? "s" : ""} leave
                  </button>
                ))}
              </span>
            )}
          </label>
          )}
          <div className="flex items-start gap-2 pt-5">
            <button id="analyse-btn" onClick={() => analyze(false)} disabled={loading} className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
              {loading ? "Analysing…" : "Analyse"}
            </button>
            {analysis && (
              <button onClick={() => analyze(true)} disabled={loading} className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
                Re-run
              </button>
            )}
          </div>
        </section>

        {error && <p className="mt-4 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
        {loading && progress && (
          <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {progress.step}
            {progress.total ? ` · ${progress.done} / ${progress.total}` : ""}
            {progress.total ? (
              <span className="ml-3 inline-block h-1.5 w-40 overflow-hidden rounded bg-zinc-800 align-middle">
                <span className="block h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${((progress.done ?? 0) / progress.total) * 100}%` }} />
              </span>
            ) : null}
          </div>
        )}

        {analysis && (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Files analysed" value={`${analysis.analysedFiles} / ${analysis.totalFiles}`} />
              <Stat label="Departed authors" value={String(departed.size)} />
              <Stat label="Lines last touched by departed" value={totalLines ? `${Math.round((orphanedLines / totalLines) * 100)}%` : "0%"} />
              <Stat label="High-risk files (score ≥ 60)" value={String(redCount)} accent={redCount > 0} />
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>Tile size = lines of code. Colour = Orphaned Criticality Score.</span>
                  <span className="flex items-center gap-1">
                    safe <i className="inline-block h-3 w-8 rounded" style={{ background: `linear-gradient(90deg, ${scoreColor(5)}, ${scoreColor(50)}, ${scoreColor(100)})` }} /> critical
                  </span>
                </div>
                <Treemap files={scored} selected={selected} onSelect={(p) => { setSelected(p); setBrief(null); setBriefError(null); }} />
                {departed.size === 0 && <p className="mt-2 text-xs text-zinc-500">{mode === "notice" ? "Enter the leaver's git email to light up their files." : "Add departed emails or click a \u201csimulate layoffs\u201d button to light up the map."}</p>}

                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                  <span className="shrink-0">Time machine</span>
                  <input type="range" min={0} max={MONTHS_BACK} step={1} value={monthsAgo} onChange={(e) => setMonthsAgo(Number(e.target.value))} className="w-full accent-zinc-200" style={{ direction: "rtl" }} />
                  <span className="w-44 shrink-0 text-right">
                    {asOf ? (
                      <>as of <span className="text-zinc-200">{asOf.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span> <span className="rounded bg-amber-900/60 px-1 text-[10px] text-amber-200">commit-based</span></>
                    ) : (
                      <span className="text-zinc-200">today (blame + commits)</span>
                    )}
                  </span>
                </div>

                {mode === "layoffs" && departedForCharts.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Knowledge absorption since they left</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {departedForCharts.map((email) => <DecayChart key={email} files={analysis.files} email={email} name={analysis.authors[email]?.name ?? email} />)}
                    </div>
                  </div>
                )}
              </div>

              <aside className="min-w-0">
                {!selectedFile && mode === "notice" && noticeEmail && departed.size > 0 && (
                  <HandoverPanel analysis={analysis} repoUrl={repoUrl} email={[...departed][0]} lastDay={lastDay} extraDeparted={new Set()} onSelect={(p) => setSelected(p)} />
                )}
                {!selectedFile && mode === "notice" && (!noticeEmail || departed.size === 0) && (
                  <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">Enter the leaver&rsquo;s git email above to get their handover plan.</div>
                )}
                {!selectedFile && mode === "layoffs" && (
                  <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
                    <p className="mb-3 font-medium text-zinc-200">Riskiest files</p>
                    <ol className="space-y-1">
                      {scored.slice(0, 12).map((f) => (
                        <li key={f.path} className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 shrink-0 rounded-sm transition-[background-color] duration-500" style={{ background: scoreColor(f.score) }} />
                          <button onClick={() => setSelected(f.path)} className="truncate text-left font-mono text-xs hover:text-white">{f.path}</button>
                          <span className="ml-auto text-xs text-zinc-500">{f.score}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {selectedFile && (
                  <div className="rounded-lg border border-zinc-800 p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="break-all font-mono text-xs text-zinc-200">{selectedFile.path}</p>
                      <button onClick={() => setSelected(null)} className="text-xs text-zinc-500 hover:text-white">close</button>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold transition-colors duration-500" style={{ color: scoreColor(Math.max(selectedFile.score, 20)) }}>{selectedFile.score}</span>
                      <span className="text-xs text-zinc-500">orphaned criticality, 0–100</span>
                    </div>

                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <Factor label="Orphan share" value={`${Math.round(selectedFile.orphanShare * 100)}%`} hint={`${Math.round(selectedFile.blameShare * 100)}% of lines · ${Math.round(selectedFile.commitShare * 100)}% of commits`} />
                      <Factor label="Churn" value={String(selectedFile.commits12m)} hint="commits, 12 months" />
                      <Factor label="Load-bearing" value={String(selectedFile.inbound)} hint="files import this" />
                    </dl>
                    <p className="mt-1 text-[10px] text-zinc-600">Orphan share blends 60% blame lines with 40% of the last 24 months of commits, so one formatting commit cannot flip ownership.</p>

                    <p className="mt-4 mb-1 text-xs uppercase tracking-wide text-zinc-500">Who owns it</p>
                    <ul className="space-y-1">
                      {Object.entries(selectedFile.authors)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6)
                        .map(([email, n]) => {
                          const gone = departed.has(email);
                          const listed = mode === "notice" ? parseDeparted(noticeEmail).includes(email) : parseDeparted(departedText).includes(email);
                          const commits = selectedFile.commitAuthors?.[email] ?? 0;
                          return (
                            <li key={email} className="flex items-center gap-2 text-xs">
                              <span className={`inline-block h-2 w-2 rounded-full ${gone ? "bg-red-500" : "bg-emerald-500"}`} />
                              <span className="truncate font-mono text-zinc-300" title={email}>{analysis.authors[email]?.name ?? email}</span>
                              <span className="whitespace-nowrap text-zinc-500">{Math.round((n / selectedFile.lines) * 100)}% lines · {commits} commits</span>
                              {listed && (
                                <button
                                  onClick={() => setStillHere((s) => { const next = new Set(s); if (next.has(email)) next.delete(email); else next.add(email); return next; })}
                                  className="ml-auto whitespace-nowrap rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white"
                                >
                                  {gone ? "mark as still here" : "mark as departed"}
                                </button>
                              )}
                            </li>
                          );
                        })}
                    </ul>

                    <button onClick={() => explain(selectedFile.path)} disabled={briefLoading} className="mt-4 w-full rounded bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">
                      {briefLoading ? "Reading history…" : "Why does this code exist?"}
                    </button>
                    {briefError && <p className="mt-2 text-xs text-red-300">{briefError}</p>}
                    {brief && <BriefView brief={brief.brief} evidence={brief.evidence} model={brief.model} />}
                    <AskGhost repoUrl={repoUrl} file={selectedFile.path} />
                  </div>
                )}
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? "text-red-400" : ""}`}>{value}</p>
    </div>
  );
}

function Factor({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded bg-zinc-900 p-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      <dd className="text-[10px] text-zinc-500">{hint}</dd>
    </div>
  );
}

function BriefView({ brief, evidence, model }: { brief: Brief; evidence: Evidence[]; model: string }) {
  const byId = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const Ev = ({ ids }: { ids: string[] }) => (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {ids.map((id) => byId[id] ? (
        <a key={id} href={byId[id].url} target="_blank" title={byId[id].title} className="rounded bg-zinc-800 px-1 text-[10px] text-sky-300 hover:bg-zinc-700">{id}</a>
      ) : (
        <span key={id} className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-500">{id}</span>
      ))}
    </span>
  );
  return (
    <div className="mt-4 space-y-3 border-t border-zinc-800 pt-3 text-xs">
      <p className="leading-relaxed text-zinc-200">{brief.purpose}</p>
      {brief.claims.length > 0 && (
        <div>
          <p className="mb-1 uppercase tracking-wide text-zinc-500">Why it is the way it is</p>
          <ul className="space-y-1.5">
            {brief.claims.map((c, i) => (
              <li key={i} className="leading-relaxed">
                <span className={`mr-1 rounded px-1 text-[10px] ${c.status === "documented" ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}>{c.status}</span>
                {c.claim}
                {c.evidence.length > 0 && <Ev ids={c.evidence} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.undocumented.length > 0 && (
        <div>
          <p className="mb-1 uppercase tracking-wide text-zinc-500">Reason not documented</p>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">{brief.undocumented.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}
      {brief.risks.length > 0 && (
        <div>
          <p className="mb-1 uppercase tracking-wide text-zinc-500">What could break</p>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">{brief.risks.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}
      {brief.safeChangeChecklist.length > 0 && (
        <div>
          <p className="mb-1 uppercase tracking-wide text-zinc-500">Before you change it</p>
          <ul className="list-disc space-y-1 pl-4 text-zinc-300">{brief.safeChangeChecklist.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}
      <p className="text-[10px] text-zinc-600">Evidence: {evidence.length} items · model {model} · saved to the report</p>
    </div>
  );
}
