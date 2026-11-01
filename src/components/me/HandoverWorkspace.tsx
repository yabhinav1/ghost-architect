"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PendingWork } from "@/components/PendingWork";
import type { Handover } from "@/lib/types";

type Item = Handover & { orgName: string; orgSlug: string; mine: "leaver" | "receiver" };

/**
 * The leaver fills in notes and links per file and ticks it off; the receiver reads them and can also tick.
 * Everything saves on blur, so a walkthrough can happen with both people editing live.
 */
export function HandoverWorkspace({ handover }: { handover: Item }) {
  const router = useRouter();
  const [files, setFiles] = useState(handover.files);
  const [addPath, setAddPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = files.filter((f) => f.done).length;
  const pct = files.length ? Math.round((done / files.length) * 100) : 0;
  const slug = handover.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/handover/${handover.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setFiles(d.handover.files);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const update = (path: string, change: Partial<Item["files"][number]>) => {
    setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, ...change } : f)));
  };
  const save = (path: string) => {
    const f = files.find((x) => x.path === path);
    if (f) patch({ files: [{ path, notes: f.notes, links: f.links, done: f.done }] });
  };

  return (
    <section id={`handover-${handover.id}`} className="card">
      <div className="card-header">
        <span className="font-mono text-[12px]">{slug}</span>
        <span className="font-normal text-fg-muted">· {handover.mine === "leaver" ? "you are handing over" : "you are receiving"} · {handover.orgName}</span>
        {handover.dueDate && <span className="label label-muted">due {handover.dueDate}</span>}
        <span className={`ml-auto label ${handover.status === "complete" ? "label-success" : "label-accent"}`}>{handover.status === "complete" ? "complete" : `${done}/${files.length} done`}</span>
      </div>
      <div className="px-4 pt-3"><div className="progress"><span style={{ width: `${pct}%` }} /></div></div>
      <ul className="divide-y divide-border-muted">
        {files.map((f) => (
          <li key={f.path} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" className="check" checked={f.done} onChange={(e) => { const v = e.target.checked; update(f.path, { done: v }); patch({ files: [{ path: f.path, done: v }] }); }} />
              <Link href={`/r/${slug}?file=${encodeURIComponent(f.path)}`} className={`font-mono text-[12px] hover:underline ${f.done ? "text-fg-muted line-through" : "text-accent"}`}>{f.path}</Link>
              {f.doneAt && <span className="text-[11px] text-fg-subtle">done {f.doneAt.slice(0, 10)}</span>}
              <button onClick={() => patch({ removeFile: f.path })} className="ml-auto text-[11px] text-fg-subtle hover:text-danger" title="Remove from this handover">remove</button>
            </div>
            <textarea value={f.notes} onChange={(e) => update(f.path, { notes: e.target.value })} onBlur={() => save(f.path)} rows={2} className="input mt-2 text-[12px]" placeholder={handover.mine === "leaver" ? "Why this file exists, gotchas, who to ask, what not to touch…" : "Questions for the leaver, things confirmed in the walkthrough…"} />
            <input value={f.links.join(" ")} onChange={(e) => update(f.path, { links: e.target.value.split(/\s+/).filter(Boolean) })} onBlur={() => save(f.path)} className="input mt-1 font-mono text-[11px]" placeholder="Links, space separated: design doc, ticket, runbook, PR…" />
            {f.links.length > 0 && <p className="mt-1 flex flex-wrap gap-2 text-[11px]">{f.links.map((l) => <a key={l} href={l} target="_blank" className="text-accent hover:underline">{l.replace(/^https?:\/\//, "").slice(0, 60)}</a>)}</p>}
          </li>
        ))}
        {files.length === 0 && <li className="px-4 py-4 text-[13px] text-fg-muted">No files listed. Add the ones that matter below, or ask a manager to analyse the repository first.</li>}
      </ul>
      <PendingWork slug={handover.orgSlug} login={handover.leaverLogin} repoUrl={handover.repoUrl} files={files} />
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <input value={addPath} onChange={(e) => setAddPath(e.target.value)} className="input w-72 font-mono text-[12px]" placeholder="add a file path, e.g. src/billing/retry.ts" />
        <button onClick={() => { if (addPath.trim()) { patch({ addFile: addPath.trim() }); setAddPath(""); } }} disabled={saving || !addPath.trim()} className="btn btn-sm">Add file</button>
        <span className="flex-1" />
        {handover.status === "open" ? (
          <button onClick={() => { if (confirm("Mark this handover complete?")) patch({ status: "complete" }); }} disabled={saving} className="btn btn-sm btn-primary">Mark complete</button>
        ) : (
          <button onClick={() => patch({ status: "open" })} disabled={saving} className="btn btn-sm">Reopen</button>
        )}
        <a href={`/r/${slug}`} className="btn btn-sm">Open repository</a>
        {saving && <span className="text-[11px] text-fg-muted">saving…</span>}
        {error && <span className="text-[11px] text-danger">{error}</span>}
      </div>
    </section>
  );
}
