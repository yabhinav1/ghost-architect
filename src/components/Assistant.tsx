"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import type { Scored } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

export type AssistantContext = {
  mode: "layoffs" | "notice";
  selectedFile: string | null;
  selectedScore?: number;
  departed: string[];
  stats: { files: number; authors: number; redCount: number; orphanPct: number };
  topFiles: Scored[];
  knownFiles: string[];
};

export function Assistant({ repoUrl, context, onOpenFile }: { repoUrl: string; context: AssistantContext; onOpenFile: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Proactive hint: when a red file is opened, offer to explain it. Once per file per session.
  const [hint, setHint] = useState<{ file: string; question: string } | null>(null);
  const hinted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const f = context.selectedFile;
    if (!f || open || (context.selectedScore ?? 0) < 60 || hinted.current.has(f)) return;
    hinted.current.add(f);
    const short = f.split("/").pop();
    const t = setTimeout(() => setHint({ file: f, question: `Why is ${short} red, and what should I check before changing it?` }), 900);
    const t2 = setTimeout(() => setHint(null), 12000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [context.selectedFile, context.selectedScore, open]);

  // First-visit nudge bubble, once per browser.
  useEffect(() => {
    if (localStorage.getItem("casper-nudged")) return;
    const t = setTimeout(() => setNudge(true), 2500);
    const t2 = setTimeout(() => setNudge(false), 11000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (open) {
      localStorage.setItem("casper-nudged", "1");
      setNudge(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = useMemo(() => {
    const s: string[] = [];
    if (context.selectedFile) {
      const short = context.selectedFile.split("/").pop();
      s.push(`What does ${short} do?`, `Why is ${short} risky?`, "What should I check before changing it?");
    } else {
      s.push("What am I looking at?", "Which file should I open first?");
    }
    if (context.departed.length === 0) s.push("Why is everything grey?");
    else s.push("Who should take over the riskiest file?");
    s.push(context.mode === "notice" ? "How does the handover plan work?" : "What does the score mean?");
    return s.slice(0, 4);
  }, [context.selectedFile, context.departed.length, context.mode]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          repoUrl,
          messages: next,
          context: {
            mode: context.mode,
            selectedFile: context.selectedFile,
            departed: context.departed,
            stats: context.stats,
            topFiles: context.topFiles.slice(0, 10).map((f) => ({ path: f.path, score: f.score, orphanShare: f.orphanShare, commits12m: f.commits12m, inbound: f.inbound })),
            knownFiles: context.knownFiles.slice(0, 300),
          },
        }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: snapshot } : x)));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: `Casper hit a snag: ${(e as Error).message}` } : x)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* floating button */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <div className={`casper-nudge card max-w-[260px] px-3 py-2 text-[12px] shadow-xl ${(hint || nudge) && !open ? "is-on" : ""}`} aria-hidden={!(hint || nudge) || open}>
          {hint ? (
            <>
              <p className="font-semibold">That one&rsquo;s red.</p>
              <p className="text-fg-muted">Want me to explain why <span className="font-mono text-fg">{hint.file.split("/").pop()}</span> scores high and what to check before touching it?</p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => { const q = hint.question; setHint(null); setOpen(true); setTimeout(() => send(q), 300); }} className="btn btn-sm btn-primary">Yes, tell me</button>
                <button onClick={() => setHint(null)} className="btn btn-sm">Not now</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Hi, I&rsquo;m Casper.</p>
              <p className="text-fg-muted">New here? Ask me what this repo&rsquo;s heatmap means or what any file does.</p>
            </>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Casper" : "Ask Casper"}
          data-tour="casper"
          className={`casper-fab flex items-center gap-2 rounded-full border border-border bg-canvas-overlay pr-4 pl-1.5 py-1.5 text-[13px] font-semibold shadow-xl ${open ? "is-open" : ""}`}
        >
          <span className="casper-head"><Mascot size={40} /></span>
          {open ? "Close" : "Ask Casper"}
        </button>
      </div>

      {/* panel */}
      <section className={`casper-panel card fixed bottom-20 right-5 z-40 flex w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden shadow-2xl ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <header className="card-header">
          <Mascot size={26} />
          <span className="flex-1">Casper <span className="ml-1 font-normal text-fg-muted">knows this repo</span></span>
          {messages.length > 0 && <button onClick={() => { abort.current?.abort(); setMessages([]); }} className="btn btn-sm btn-invisible text-fg-muted">Clear</button>}
        </header>

        <div ref={listRef} className="max-h-[52vh] min-h-[220px] flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="casper-msg flex gap-2">
              <Mascot size={28} className="shrink-0" />
              <div className="rounded-2xl rounded-tl-sm bg-canvas-subtle px-3 py-2 text-[13px] leading-relaxed">
                {context.selectedFile ? (
                  <>You have <span className="font-mono text-[12px] text-accent">{context.selectedFile.split("/").pop()}</span> open. Ask me what it does, why it scores {context.topFiles.find((f) => f.path === context.selectedFile)?.score ?? 0}, or what to check before changing it.</>
                ) : context.departed.length === 0 ? (
                  <>The map is grey because nobody is marked as departed yet. Pick who is leaving above, or try &ldquo;simulate: top 3&rdquo; in Layoffs mode, and I&rsquo;ll walk you through what lights up.</>
                ) : (
                  <>This repo has {context.stats.redCount} high-risk files and {context.stats.orphanPct}% of its lines were last touched by people who left. Ask me which file to open first.</>
                )}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`casper-msg flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <Mascot size={28} className="shrink-0" />}
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "rounded-tr-sm bg-accent-emphasis text-white" : "rounded-tl-sm bg-canvas-subtle"}`}>
                {m.role === "assistant" && m.content === "" && busy ? (
                  <span className="casper-typing inline-flex gap-1 py-1"><i /><i /><i /></span>
                ) : (
                  <Rich text={m.content} known={context.knownFiles} onOpenFile={onOpenFile} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-3 pt-2">
          <div className="flex flex-wrap gap-1.5 pb-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy} className="btn btn-sm !rounded-full !py-0.5 !text-[11px]">{s}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 pb-3">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this repo or any file…" className="input flex-1 text-[13px]" />
            <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary">Send</button>
          </form>
        </div>
      </section>
    </>
  );
}

/** Minimal rich text: paragraphs, bullets, **bold**, `code`, and clickable file paths. */
function Rich({ text, known, onOpenFile }: { text: string; known: string[]; onOpenFile: (p: string) => void }) {
  const lines = text.split("\n");
  const blocks: { kind: "p" | "li"; text: string }[] = [];
  for (const l of lines) {
    const t = l.trimEnd();
    if (!t.trim()) continue;
    if (/^\s*([-*•]|\d+\.)\s+/.test(t)) blocks.push({ kind: "li", text: t.replace(/^\s*([-*•]|\d+\.)\s+/, "") });
    else blocks.push({ kind: "p", text: t });
  }
  const inline = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <b key={i}>{p.slice(2, -2)}</b>;
      if (p.startsWith("`") && p.endsWith("`")) {
        const code = p.slice(1, -1);
        const hit = known.find((k) => k === code || k.endsWith("/" + code));
        return hit ? (
          <button key={i} onClick={() => onOpenFile(hit)} className="rounded bg-canvas-inset px-1 font-mono text-[11px] text-accent hover:underline" title={`Open ${hit}`}>{code}</button>
        ) : (
          <code key={i} className="rounded bg-canvas-inset px-1 font-mono text-[11px]">{code}</code>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) =>
        b.kind === "li" ? (
          <div key={i} className="flex gap-1.5"><span className="text-fg-subtle">•</span><span>{inline(b.text)}</span></div>
        ) : (
          <p key={i}>{inline(b.text)}</p>
        ),
      )}
    </div>
  );
}
