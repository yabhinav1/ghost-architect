"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AskGhost } from "@/components/AskGhost";
import { Assistant } from "@/components/Assistant";
import { DecayChart } from "@/components/DecayChart";
import { HandoverPanel } from "@/components/HandoverPanel";
import { PrCheck } from "@/components/PrCheck";
import { Sparkline } from "@/components/Sparkline";
import { Tour, type TourStep } from "@/components/Tour";
import { Treemap } from "@/components/Treemap";
import { Avatar, Card, Octicon, ShareBar } from "@/components/ui";
import { Mark } from "@/components/Mascot";
import { UserMenu } from "@/components/UserMenu";
import { codeownersText, scoreFilesAt } from "@/lib/insights";
import { downloadTreemapPng } from "@/lib/treemap-image";
import { scoreColor, scoreFiles } from "@/lib/score";
import type { Analysis, Brief, BriefResult, Evidence, Progress, RepoState, Scored, SessionUser } from "@/lib/types";

type Mode = "layoffs" | "notice";
const MONTHS_BACK = 30;
const SAMPLE_REPOS = [
  { url: "https://github.com/expressjs/express", lang: "JavaScript", color: "#f1e05a", blurb: "Fast, unopinionated web framework for Node. Two authors own most of it." },
  { url: "https://github.com/pallets/flask", lang: "Python", color: "#3572A5", blurb: "The Python micro framework. One maintainer carries the core." },
  { url: "https://github.com/axios/axios", lang: "JavaScript", color: "#f1e05a", blurb: "Promise-based HTTP client. Many contributors, concentrated ownership." },
];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const TOUR_KEY = "ga-tour-v1";
const TOUR: TourStep[] = [
  { target: "heatmap", title: "The heatmap", body: "One tile per file. Size is lines of code, colour is the Orphaned Criticality Score: how much of the file was written by people who left, times how often it changes, times how many files depend on it. Hover for the factors, click to open." },
  { target: "modes", title: "Two ways in", body: "Notice period: one engineer is leaving, get a handover plan. Layoffs: many left at once, see the blast radius. Everything below recomputes instantly when you switch." },
  { target: "leaver", title: "Who is leaving", body: "Type a git email, pick a top owner, upload a CSV, or hit a simulate button to pretend the biggest contributors are gone. Nothing is orphaned until someone is marked departed.", place: "bottom" },
  { target: "panel", title: "The file panel", body: "Score, the three factors, who owns the lines, and the big one: \u201cWhy does this code exist?\u201d, a brief built from commits and PRs where every claim cites evidence or admits it is undocumented.", place: "left" },
  { target: "casper", title: "Meet Casper", body: "Stuck? Casper knows this repo and this app. Ask what a file does, why a tile is red, or what to click next. He reads the file before answering.", place: "top" },
];

function parseDeparted(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

function repoSlug(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/, "").replace(/\/+$/, "");
}

export function AnalysisApp({ initialRepo, autoRun = false, user = null }: { initialRepo?: string; autoRun?: boolean; user?: SessionUser | null }) {
  const [repoUrl, setRepoUrl] = useState(initialRepo ?? "");
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
  const [mode, setMode] = useState<Mode>("notice");
  const [noticeEmail, setNoticeEmail] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [monthsAgo, setMonthsAgo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [kt, setKt] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const stateLoadedFor = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  const selectedFile = scored.find((f) => f.path === selected) ?? null;
  const redCount = scored.filter((f) => f.score >= 60).length;
  const orphanedLines = scored.reduce((s, f) => s + f.departedLines, 0);
  const totalLines = scored.reduce((s, f) => s + f.lines, 0);
  const topAuthors = useMemo(() => (analysis ? Object.entries(analysis.authors).sort((a, b) => b[1].lines - a[1].lines) : []), [analysis]);

  useEffect(() => {
    if (autoRan.current) return;
    const p = new URLSearchParams(window.location.search);
    const repo = p.get("repo") ?? (autoRun ? initialRepo : null);
    if (!repo) return;
    autoRan.current = true;
    const t = setTimeout(() => {
      setRepoUrl(repo);
      if (p.get("departed")) setDepartedText(p.get("departed")!.split(",").join("\n"));
      setMode(p.get("mode") === "notice" ? "notice" : "layoffs");
      if (p.get("email")) setNoticeEmail(p.get("email")!);
      if (p.get("lastDay")) setLastDay(p.get("lastDay")!);
      setTimeout(() => document.getElementById("analyse-btn")?.click(), 0);
    }, 0);
    return () => clearTimeout(t);
  }, [autoRun, initialRepo]);

  // Signed-in users get their scenario for this repo back: who left, who is leaving, KT ticks.
  useEffect(() => {
    if (!analysis || !user) return;
    const repo = analysis.repoUrl;
    if (stateLoadedFor.current === repo) return;
    let cancelled = false;
    setSaveState("loading");
    fetch(`/api/me/state?repo=${encodeURIComponent(repo)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { state: RepoState | null } | null) => {
        if (cancelled) return;
        const st = d?.state;
        if (st) {
          setMode(st.mode);
          setDepartedText(st.departed.join("\n"));
          setStillHere(new Set(st.stillHere));
          setNoticeEmail(st.noticeEmail);
          setLastDay(st.lastDay);
          setKt(new Set(st.kt));
        }
        stateLoadedFor.current = repo;
        setSaveState(st ? "saved" : "idle");
      })
      .catch(() => { if (!cancelled) setSaveState("error"); });
    return () => { cancelled = true; };
  }, [analysis, user]);

  useEffect(() => {
    if (!analysis || !user || stateLoadedFor.current !== analysis.repoUrl) return;
    clearTimeout(saveTimer.current);
    setSaveState("saving");
    const body = { repo: analysis.repoUrl, state: { mode, departed: parseDeparted(departedText), stillHere: [...stillHere], noticeEmail, lastDay, kt: [...kt] } };
    saveTimer.current = setTimeout(() => {
      fetch("/api/me/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => setSaveState(r.ok ? "saved" : "error"))
        .catch(() => setSaveState("error"));
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [analysis, user, mode, departedText, stillHere, noticeEmail, lastDay, kt]);

  useEffect(() => {
    if (!analysis) return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(t);
  }, [analysis]);

  function closeTour() {
    localStorage.setItem(TOUR_KEY, "1");
    setTourOpen(false);
  }

  async function exportPng() {
    if (!analysis) return;
    setExporting(true);
    try {
      const slug = repoSlug(analysis.repoUrl);
      const who = departed.size ? `${departed.size} departed` : "nobody departed";
      await downloadTreemapPng(scored, { title: `${slug} · orphaned criticality`, subtitle: `${analysis.analysedFiles} files · ${who} · ${asOf ? "as of " + asOf.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : analysis.analyzedAt.slice(0, 10)}`, filename: `${slug.replace("/", "-")}-heatmap.png` });
    } finally {
      setExporting(false);
    }
  }

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
      const res = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl, file, departed: [...departed] }) });
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
    setDepartedText(topAuthors.slice(0, n).map(([email]) => email).join("\n"));
    setStillHere(new Set());
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setDepartedText(parseDeparted(await f.text()).join("\n"));
    setStillHere(new Set());
    if (fileInput.current) fileInput.current.value = "";
  }

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
    const blob = new Blob([codeownersText(scoreFiles(analysis.files, departed), departed, analysis.authors)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "CODEOWNERS";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toggleStillHere(email: string) {
    setStillHere((s) => {
      const next = new Set(s);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  const reportHref = analysis ? `/report?repo=${encodeURIComponent(repoUrl)}&departed=${encodeURIComponent([...departed].join(","))}` : "#";
  const listedEmails = mode === "notice" ? parseDeparted(noticeEmail) : parseDeparted(departedText);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-canvas-inset/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold">
            <Mark size={26} className="text-fg" />
            <span className="hidden sm:inline">Ghost-Architect</span>
          </Link>
          <form onSubmit={(e) => { e.preventDefault(); analyze(false); }} className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:ml-2 sm:w-auto sm:flex-1">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <Octicon name="search" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-fg-subtle" />
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="input pl-8 font-mono text-[13px]" placeholder="https://github.com/owner/repo" spellCheck={false} />
            </div>
            <button id="analyse-btn" type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Analysing…" : "Analyse"}
            </button>
          </form>
          <div className="segmented" data-tour="modes">
            {(["notice", "layoffs"] as Mode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setStillHere(new Set()); setSelected(null); }}>
                {m === "notice" ? "Notice period" : "Layoffs"}
              </button>
            ))}
          </div>
          {user ? <UserMenu user={user} /> : <Link href="/" className="btn btn-sm">Sign in</Link>}
        </div>
      </header>

      {/* Repo header strip */}
      {analysis && (
        <div className="border-b border-border bg-canvas-subtle">
          <div className="mx-auto max-w-[1400px] px-3 pt-4 pb-0 sm:px-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Octicon name="repo" className="h-4 w-4 text-fg-muted" />
              <h1 className="text-xl font-semibold">
                <a href={analysis.repoUrl} target="_blank" className="text-accent hover:underline">{repoSlug(analysis.repoUrl).split("/")[0]}</a>
                <span className="mx-1 text-fg-muted">/</span>
                <a href={analysis.repoUrl} target="_blank" className="text-accent hover:underline">{repoSlug(analysis.repoUrl).split("/")[1]}</a>
              </h1>
              <span className={`label ${analysis.private ? "label-attention" : "label-muted"}`}>{analysis.private ? "Private" : analysis.private === false ? "Public" : "Git"}</span>
              <span className="ml-auto flex items-center gap-2">
                <button onClick={copyShare} className="btn btn-sm"><Octicon name="share" className="h-3.5 w-3.5" />{copied ? "Copied" : "Share"}</button>
                <button onClick={downloadCodeowners} disabled={departed.size === 0} className="btn btn-sm" title="Proposes a still-here owner for every risky file"><Octicon name="download" className="h-3.5 w-3.5" />CODEOWNERS</button>
                <a href={reportHref} target="_blank" className="btn btn-sm"><Octicon name="report" className="h-3.5 w-3.5" />Report</a>
                <span className="text-[11px] text-fg-subtle" title={user ? "Your departed list, leaver and KT ticks are saved to your account" : "Sign in to keep your scenario across devices"}>
                  {user ? (saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to your account" : saveState === "error" ? "Not saved" : saveState === "loading" ? "Loading your scenario…" : "") : "Sign in to save"}
                </span>
                <button onClick={() => setTourOpen(true)} className="btn btn-sm btn-invisible" title="Guided tour">Tour</button>
                <button onClick={() => analyze(true)} disabled={loading} className="btn btn-sm btn-invisible" title="Re-clone and re-analyse"><Octicon name="history" className="h-3.5 w-3.5" /></button>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-fg-muted sm:text-[13px]">
              <span className="flex items-center gap-1.5"><Octicon name="file" className="h-4 w-4" /><b className="text-fg">{analysis.analysedFiles}</b> of {analysis.totalFiles} code files</span>
              <span className="flex items-center gap-1.5"><Octicon name="people" className="h-4 w-4" /><b className="text-fg">{Object.keys(analysis.authors).length}</b> authors</span>
              <span className="flex items-center gap-1.5"><Octicon name="people" className="h-4 w-4 text-danger" /><b className="text-fg">{departed.size}</b> departed</span>
              <span className="flex items-center gap-1.5"><Octicon name="flame" className={`h-4 w-4 ${redCount ? "text-danger" : ""}`} /><b className={redCount ? "text-danger" : "text-fg"}>{redCount}</b> high-risk files</span>
              <span className="flex items-center gap-1.5"><Octicon name="history" className="h-4 w-4" /><b className="text-fg">{totalLines ? Math.round((orphanedLines / totalLines) * 100) : 0}%</b> of lines last touched by departed</span>
              <span className="ml-auto text-fg-subtle">analysed {analysis.analyzedAt.slice(0, 10)}</span>
            </div>
            <div className="mt-3">
              <ShareBar
                total={totalLines}
                parts={[
                  { key: "gone", value: orphanedLines, color: "#da3633", title: "lines last touched by departed authors" },
                  { key: "here", value: totalLines - orphanedLines, color: "#238636", title: "lines last touched by people still here" },
                ]}
                className="h-2"
              />
            </div>
            <div className="underline-nav mt-3">
              <button aria-current="page" data-active="true">Heatmap</button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 sm:py-5">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2 text-[13px] text-fg">
            <Octicon name="flame" className="mt-0.5 h-4 w-4 text-danger" />
            <span className="flex-1">{error}</span>
            {!user && /sign in/i.test(error) && <a href="/api/auth/login" className="btn btn-sm btn-primary">Sign in with GitHub</a>}
          </div>
        )}
        {loading && progress && (
          <div className="mb-4 rounded-md border border-border bg-canvas-subtle px-3 py-2 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="ghost-pulse inline-block h-2 w-2 rounded-full bg-success" />
              <span>{progress.step}</span>
              {progress.total ? <span className="counter">{progress.done} / {progress.total}</span> : null}
            </div>
            {progress.total ? <div className="progress mt-2 w-80"><span style={{ width: `${((progress.done ?? 0) / progress.total) * 100}%` }} /></div> : null}
          </div>
        )}

        {!analysis && !loading && (
          <div className="mx-auto max-w-3xl">
            <div className="blankslate">
              <Octicon name="ghost" className="mx-auto mb-3 h-12 w-12 text-fg-subtle" />
              <h3>Find the code nobody understands anymore</h3>
              <p>{user ? "Pick a repository from your dashboard or paste any URL above." : "Paste a public repository above, or sign in to analyse your private ones."} Ghost-Architect reads its git history, finds the files whose authors have left, and explains why that code exists from commit and pull-request evidence.</p>
            </div>
            <p className="mb-2 text-[13px] font-semibold text-fg-muted">Try a sample repository</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {SAMPLE_REPOS.map((r) => (
                <button key={r.url} onClick={() => { setRepoUrl(r.url); setTimeout(() => document.getElementById("analyse-btn")?.click(), 0); }} className="card p-3 text-left transition-colors hover:border-fg-subtle">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-accent"><Octicon name="repo" className="h-4 w-4 text-fg-muted" />{repoSlug(r.url)}</p>
                  <p className="mt-1 text-[12px] text-fg-muted">{r.blurb}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-muted"><span className="inline-block h-3 w-3 rounded-full" style={{ background: r.color }} />{r.lang}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-3 text-[13px] text-fg-muted sm:grid-cols-3">
              <div className="card p-3"><p className="font-semibold text-fg">1. Score</p>Every file gets an orphaned criticality score from blame, recent commits, and how many files import it.</div>
              <div className="card p-3"><p className="font-semibold text-fg">2. Explain</p>Click a file and the ghost writes why it exists, citing commits and PRs. Gaps are admitted, not invented.</div>
              <div className="card p-3"><p className="font-semibold text-fg">3. Hand over</p>Notice-period mode turns one leaver into a ranked handover plan with receivers and a KT checklist.</div>
            </div>
          </div>
        )}

        {analysis && analysis.analysedFiles === 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-attention/40 bg-attention-muted px-3 py-2 text-[13px]">
            <Octicon name="file" className="mt-0.5 h-4 w-4 text-attention" />
            <span>No source files were found in this repository&rsquo;s default branch, so there is nothing to score. Ghost-Architect reads code, markup and stylesheets; images, PDFs and binaries are skipped.</span>
          </div>
        )}
        {analysis && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
            <div className="min-w-0 space-y-4">
              {/* Who is leaving / departed input */}
              <div data-tour="leaver">
              <Card
                title={mode === "notice" ? "Who is leaving" : "Who left"}
                right={
                  mode === "layoffs" ? (
                    <span className="flex items-center gap-1 text-[12px] font-normal text-fg-muted">
                      simulate:
                      {[1, 3, 5].map((n) => <button key={n} onClick={() => pickTopAuthors(n)} className="btn btn-sm">top {n}</button>)}
                      <button onClick={() => fileInput.current?.click()} className="btn btn-sm">CSV</button>
                      <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onCsv} />
                    </span>
                  ) : undefined
                }
              >
                <div className="p-3">
                  {mode === "notice" ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <input value={noticeEmail} onChange={(e) => { setNoticeEmail(e.target.value); setStillHere(new Set()); }} list="author-list" className="input font-mono text-[13px]" placeholder="git email of the engineer leaving" />
                        <datalist id="author-list">
                          {topAuthors.slice(0, 40).map(([email, a]) => <option key={email} value={email}>{a.name}</option>)}
                        </datalist>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-muted">
                          <span>top owners:</span>
                          {topAuthors.slice(0, 5).map(([email, a]) => (
                            <button key={email} onClick={() => { setNoticeEmail(email); setStillHere(new Set()); }} className={`btn btn-sm ${noticeEmail === email ? "border-accent" : ""}`}>
                              <Avatar name={a.name} email={email} size={16} />{a.name.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="text-[12px] text-fg-muted">
                        Last day
                        <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="input mt-1 text-[13px]" />
                      </label>
                    </div>
                  ) : (
                    <textarea value={departedText} onChange={(e) => { setDepartedText(e.target.value); setStillHere(new Set()); }} rows={2} className="input font-mono text-[12px]" placeholder="one email per line, or paste anything containing emails" />
                  )}
                </div>
              </Card>
              </div>

              {/* Heatmap */}
              <div data-tour="heatmap">
              <Card
                title={<span className="flex items-center gap-2"><Octicon name="flame" className="h-4 w-4 text-fg-muted" />Orphaned criticality heatmap</span>}
                right={
                  <span className="flex items-center gap-3 text-[12px] font-normal text-fg-muted">
                    <span className="flex items-center gap-1.5">safe <i className="inline-block h-2.5 w-16 rounded-sm" style={{ background: `linear-gradient(90deg, ${scoreColor(5)}, ${scoreColor(55)}, ${scoreColor(100)})` }} /> critical</span>
                    <button onClick={exportPng} disabled={exporting || scored.length === 0} className="btn btn-sm" title="Download the heatmap as an image"><Octicon name="download" className="h-3.5 w-3.5" />{exporting ? "Rendering…" : "PNG"}</button>
                  </span>
                }
              >
                <div className="p-3">
                  <Treemap files={scored} selected={selected} onSelect={(p) => { setSelected(p); setBrief(null); setBriefError(null); }} />
                  {departed.size === 0 && (
                    <p className="mt-2 text-[12px] text-fg-muted">{mode === "notice" ? "Pick who is leaving to light up their files." : "Add departed emails or click a simulate button to light up the map."}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-[12px] text-fg-muted">
                    <Octicon name="clock" className="h-4 w-4" />
                    <span className="shrink-0">Time machine</span>
                    <input type="range" min={0} max={MONTHS_BACK} step={1} value={monthsAgo} onChange={(e) => setMonthsAgo(Number(e.target.value))} className="slider w-full" style={{ direction: "rtl" }} />
                    <span className="w-48 shrink-0 text-right">
                      {asOf ? (
                        <>as of <b className="text-fg">{asOf.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</b> <span className="label label-attention ml-1">commit-based</span></>
                      ) : (
                        <b className="text-fg">today</b>
                      )}
                    </span>
                  </div>
                </div>
              </Card>
              </div>

              <PrCheck repoUrl={analysis.repoUrl} analysis={analysis} scored={scored} departed={departed} onSelect={(p) => { setSelected(p); setBrief(null); setBriefError(null); }} />

              {mode === "layoffs" && departed.size > 0 && (
                <Card title={<span className="flex items-center gap-2"><Octicon name="history" className="h-4 w-4 text-fg-muted" />Knowledge absorption since they left</span>}>
                  <div className="grid gap-3 p-3 md:grid-cols-3">
                    {[...departed].slice(0, 3).map((email) => <DecayChart key={email} files={analysis.files} email={email} name={analysis.authors[email]?.name ?? email} />)}
                  </div>
                </Card>
              )}
            </div>

            {/* Side panel */}
            <aside className="min-w-0" data-tour="panel">
              {!selectedFile && mode === "notice" && departed.size > 0 && (
                <HandoverPanel analysis={analysis} repoUrl={repoUrl} email={[...departed][0]} lastDay={lastDay} extraDeparted={new Set()} onSelect={(p) => setSelected(p)} done={kt} onToggleDone={(p) => setKt((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; })} />
              )}
              {!selectedFile && mode === "notice" && departed.size === 0 && (
                <Card title="Handover plan">
                  <div className="blankslate !py-8"><p>Pick who is leaving to get their handover plan.</p></div>
                </Card>
              )}
              {!selectedFile && mode === "layoffs" && (
                <Card title={<span>Riskiest files <span className="counter ml-1">{scored.filter((f) => f.score > 0).length}</span></span>}>
                  <ul>
                    {scored.slice(0, 14).map((f) => (
                      <li key={f.path} className="flex items-center gap-2 border-b border-border-muted px-3 py-1.5 last:border-0 hover:bg-canvas-subtle">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-sm transition-[background-color] duration-500" style={{ background: scoreColor(f.score) }} />
                        <button onClick={() => setSelected(f.path)} className="truncate text-left font-mono text-[12px] text-accent hover:underline">{f.path}</button>
                        <span className="counter ml-auto">{f.score}</span>
                      </li>
                    ))}
                    {departed.size === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-muted">Nothing is orphaned until someone leaves.</li>}
                  </ul>
                </Card>
              )}

              {selectedFile && (
                <Card
                  title={<span className="flex items-center gap-2 font-mono text-[12px] font-normal"><Octicon name="file" className="h-4 w-4 text-fg-muted" /><span className="truncate">{selectedFile.path}</span></span>}
                  right={<button onClick={() => setSelected(null)} className="btn btn-sm btn-invisible text-fg-muted">Close</button>}
                >
                  <div className="p-3">
                    <div className="flex items-end gap-3">
                      <span className="text-4xl font-semibold leading-none transition-colors duration-500" style={{ color: scoreColor(Math.max(selectedFile.score, 25)) }}>{selectedFile.score}</span>
                      <div className="pb-0.5 text-[12px] text-fg-muted">
                        <p>orphaned criticality, 0 to 100</p>
                        <p>{selectedFile.lines} lines · last touched {selectedFile.lastTouched ? selectedFile.lastTouched.slice(0, 10) : "over 3 years ago"}</p>
                      </div>
                      <a href={`${analysis.repoUrl}/blob/HEAD/${selectedFile.path}`} target="_blank" className="btn btn-sm ml-auto">Open on GitHub</a>
                    </div>

                    <dl className="mt-3 grid grid-cols-3 gap-2">
                      <Factor label="Orphan share" value={`${Math.round(selectedFile.orphanShare * 100)}%`} hint={`${Math.round(selectedFile.blameShare * 100)}% lines · ${Math.round(selectedFile.commitShare * 100)}% commits`} />
                      <Factor label="Churn" value={String(selectedFile.commits12m)} hint="commits, 12 months" />
                      <Factor label="Load-bearing" value={String(selectedFile.inbound)} hint="files import this" />
                    </dl>

                    <div className="mt-3 flex items-center justify-between rounded-md border border-border-muted bg-canvas-subtle px-2 py-1.5">
                      <span className="text-[11px] text-fg-muted">Commits per month, red by departed</span>
                      <Sparkline timeline={selectedFile.timeline ?? []} departed={departed} until={analysis.analyzedAt} />
                    </div>

                    <p className="mt-4 mb-1.5 text-[12px] font-semibold text-fg-muted">Ownership</p>
                    <ShareBar
                      total={selectedFile.lines}
                      parts={Object.entries(selectedFile.authors).sort((a, b) => b[1] - a[1]).map(([email, n]) => ({ key: email, value: n, color: departed.has(email) ? "#da3633" : `hsl(${[...email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360} 45% 45%)`, title: `${analysis.authors[email]?.name ?? email}: ${n} lines` }))}
                      className="mb-2"
                    />
                    <ul className="divide-y divide-border-muted">
                      {Object.entries(selectedFile.authors).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([email, n]) => {
                        const gone = departed.has(email);
                        const listed = listedEmails.includes(email);
                        const commits = selectedFile.commitAuthors?.[email] ?? 0;
                        const name = analysis.authors[email]?.name ?? email;
                        return (
                          <li key={email} className="flex items-center gap-2 py-1.5 text-[12px]">
                            <Avatar name={name} email={email} size={20} gone={gone} />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate ${gone ? "text-fg-muted line-through" : "text-fg"}`}>{name}</span>
                              <span className="block truncate text-[11px] text-fg-subtle">{Math.round((n / selectedFile.lines) * 100)}% of lines · {commits} commits in 24m</span>
                            </span>
                            {gone && <span className="label label-danger">departed</span>}
                            {listed && (
                              <button onClick={() => toggleStillHere(email)} className="btn btn-sm">{gone ? "still here" : "departed"}</button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button onClick={() => explain(selectedFile.path)} disabled={briefLoading} className="btn btn-primary mt-4 w-full justify-center">
                      <Octicon name="ghost" className="h-4 w-4" />{briefLoading ? "Reading the history…" : "Why does this code exist?"}
                    </button>
                    {briefError && <p className="mt-2 text-[12px] text-danger">{briefError}</p>}
                    {brief && <BriefView brief={brief.brief} evidence={brief.evidence} model={brief.model} />}
                    <AskGhost repoUrl={repoUrl} file={selectedFile.path} />
                  </div>
                </Card>
              )}
            </aside>
          </div>
        )}
      </main>

      {analysis && (
        <Assistant
          repoUrl={analysis.repoUrl}
          context={{
            mode,
            selectedFile: selected,
            selectedScore: selectedFile?.score ?? 0,
            departed: [...departed],
            stats: { files: analysis.analysedFiles, authors: Object.keys(analysis.authors).length, redCount, orphanPct: totalLines ? Math.round((orphanedLines / totalLines) * 100) : 0 },
            topFiles: scored.slice(0, 10),
            knownFiles: analysis.files.map((f) => f.path),
          }}
          onOpenFile={(p) => { setSelected(p); setBrief(null); setBriefError(null); }}
        />
      )}

      {tourOpen && analysis && <Tour steps={TOUR} onClose={closeTour} />}

      <footer className="mx-auto max-w-[1400px] px-4 py-6 text-[12px] text-fg-subtle">
        Blame shows who last edited a line, not who understood it. Scores blend 60% blame with 40% of the last 24 months of commits. Confirm ownership with the team before acting.
      </footer>
    </div>
  );
}

function Factor({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border-muted bg-canvas-subtle p-2">
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="text-lg font-semibold leading-tight">{value}</dd>
      <dd className="text-[10px] text-fg-subtle">{hint}</dd>
    </div>
  );
}

function BriefView({ brief, evidence, model }: { brief: Brief; evidence: Evidence[]; model: string }) {
  const byId = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const Ev = ({ ids }: { ids: string[] }) => (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => byId[id] ? (
        <a key={id} href={byId[id].url} target="_blank" title={byId[id].title} className="label label-accent hover:underline">{id}</a>
      ) : (
        <span key={id} className="label label-muted">{id}</span>
      ))}
    </span>
  );
  return (
    <div className="mt-4 space-y-3 rounded-md border border-border bg-canvas-subtle p-3">
      <p className="text-[13px] leading-relaxed">{brief.purpose}</p>
      {brief.claims.length > 0 && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-fg-muted">Why it is the way it is</p>
          <ul className="space-y-1.5 text-[12px]">
            {brief.claims.map((c, i) => (
              <li key={i} className="leading-relaxed">
                <span className={`label mr-1 ${c.status === "documented" ? "label-success" : "label-attention"}`}>{c.status}</span>
                {c.claim}
                {c.evidence.length > 0 && <Ev ids={c.evidence} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <BriefSection title="Reason not documented" items={brief.undocumented} />
      <BriefSection title="What could break" items={brief.risks} />
      <BriefSection title="Before you change it" items={brief.safeChangeChecklist} />
      <p className="text-[11px] text-fg-subtle">{evidence.length} pieces of evidence · {model} · saved to the report</p>
    </div>
  );
}

function BriefSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold text-fg-muted">{title}</p>
      <ul className="list-disc space-y-1 pl-4 text-[12px] text-fg">{items.map((u, i) => <li key={i}>{u}</li>)}</ul>
    </div>
  );
}
