"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "starting" | "waiting" | "done" | "error";

export function DeviceLogin({ className = "", label = "Continue with GitHub" }: { className?: string; label?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState("");
  const [uri, setUri] = useState("https://github.com/login/device");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const handle = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function start() {
    setPhase("starting");
    setMessage("");
    try {
      const res = await fetch("/api/auth/device/start", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not start login");
      handle.current = d.handle;
      setCode(d.userCode);
      setUri(d.verificationUri);
      setSecondsLeft(d.expiresIn);
      setPhase("waiting");
      try {
        await navigator.clipboard.writeText(d.userCode);
        setCopied(true);
      } catch {
        // clipboard may be blocked; the user can copy manually
      }
      window.open(d.verificationUri, "_blank", "noopener");
      poll(Math.max(5, d.interval) * 1000);
    } catch (e) {
      setMessage((e as Error).message);
      setPhase("error");
    }
  }

  function poll(interval: number) {
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/device/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: handle.current }) });
        const d = await res.json();
        if (d.status === "ok") {
          setPhase("done");
          router.push("/dashboard");
          router.refresh();
          return;
        }
        if (d.status === "error") {
          setMessage(d.message);
          setPhase("error");
          return;
        }
        poll(d.slowDown ? interval + 5000 : interval);
      } catch {
        poll(interval);
      }
    }, interval);
  }

  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  if (phase === "idle" || phase === "starting") {
    return (
      <button onClick={start} disabled={phase === "starting"} className={`btn btn-primary ${className}`}>
        <GitHubMark />
        {phase === "starting" ? "Contacting GitHub…" : label}
      </button>
    );
  }

  return (
    <div className="card w-full max-w-md p-4">
      {phase === "waiting" && (
        <>
          <p className="text-[13px] text-fg-muted">Enter this code on GitHub to connect your account.</p>
          <div className="mt-3 flex items-center gap-3">
            <code className="flex-1 rounded-md border border-border bg-canvas-inset px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.3em]">{code}</code>
            <button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn">{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={uri} target="_blank" className="btn btn-primary"><GitHubMark />Open github.com/login/device</a>
            <span className="text-[12px] text-fg-muted">A tab should already be open. Waiting for you to approve…</span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-subtle">
            <span className="ghost-pulse inline-block h-2 w-2 rounded-full bg-success" />
            Code expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            <button onClick={() => { clearTimeout(timer.current); setPhase("idle"); }} className="ml-auto underline hover:text-fg">cancel</button>
          </p>
        </>
      )}
      {phase === "done" && <p className="text-[13px]">Connected. Opening your dashboard…</p>}
      {phase === "error" && (
        <>
          <p className="text-[13px] text-danger">{message}</p>
          <button onClick={start} className="btn mt-3">Try again</button>
        </>
      )}
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
