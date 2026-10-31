"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Octicon } from "@/components/ui";
import type { Member, NoticeType, OrgRole } from "@/lib/types";

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>, after?: (r: T) => void) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      after?.(r);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => call<{ org: { slug: string } }>("/api/org", "POST", { name }), (r) => router.push(`/org/${r.org.slug}`)); }} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 text-[12px] text-fg-muted">
        Organisation name
        <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" placeholder="Acme Payments" required minLength={2} />
      </label>
      <button type="submit" disabled={busy || name.trim().length < 2} className="btn btn-primary">{busy ? "Creating…" : "Create organisation"}</button>
      {error && <p className="w-full text-[12px] text-danger">{error}</p>}
    </form>
  );
}

export function InviteForm({ slug, canInviteOwner }: { slug: string; canInviteOwner: boolean }) {
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); run(() => call<{ link: string }>(`/api/org/${slug}/members`, "POST", { login: login.trim() || undefined, role }), (r) => setLink(r.link)); }} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1 text-[12px] text-fg-muted">
          GitHub login (optional, locks the link to them)
          <input value={login} onChange={(e) => setLogin(e.target.value)} className="input mt-1 font-mono text-[13px]" placeholder="octocat" />
        </label>
        <label className="text-[12px] text-fg-muted">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} className="input mt-1 w-auto">
            <option value="member">Member (engineer)</option>
            <option value="manager">Manager</option>
            {canInviteOwner && <option value="owner">Owner</option>}
          </select>
        </label>
        <button type="submit" disabled={busy} className="btn">{busy ? "Creating…" : "Create invite link"}</button>
      </form>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {link && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-canvas-subtle px-3 py-2 text-[12px]">
          <code className="flex-1 truncate font-mono">{link}</code>
          <button onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn btn-sm">{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
    </div>
  );
}

export function AddRepoForm({ slug }: { slug: string }) {
  const [url, setUrl] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => call(`/api/org/${slug}/repos`, "POST", { repoUrl: url }), () => setUrl("")); }} className="flex flex-wrap items-end gap-2">
      <label className="flex-1 text-[12px] text-fg-muted">
        Repository URL (you must be able to read it)
        <input value={url} onChange={(e) => setUrl(e.target.value)} className="input mt-1 font-mono text-[13px]" placeholder="https://github.com/acme/payments" required />
      </label>
      <button type="submit" disabled={busy || !url.trim()} className="btn">{busy ? "Linking…" : "Link repository"}</button>
      {error && <p className="w-full text-[12px] text-danger">{error}</p>}
    </form>
  );
}

export function RepoActions({ slug, repoUrl, analysed }: { slug: string; repoUrl: string; analysed: boolean }) {
  const { busy, error, run } = useAction();
  const [progress, setProgress] = useState("");
  async function analyse() {
    setProgress("starting");
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl }) });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
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
    setProgress("");
  }
  return (
    <span className="flex items-center gap-2">
      {busy && progress && <span className="text-[11px] text-fg-muted">{progress}</span>}
      <button onClick={() => run(analyse)} disabled={busy} className="btn btn-sm">{busy ? "Analysing…" : analysed ? "Re-analyse" : "Analyse"}</button>
      <button onClick={() => { if (confirm("Unlink this repository from the organisation?")) run(() => call(`/api/org/${slug}/repos?repo=${encodeURIComponent(repoUrl)}`, "DELETE")); }} disabled={busy} className="btn btn-sm btn-invisible text-fg-muted" title="Unlink">Unlink</button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </span>
  );
}

export function MemberRow({ slug, member, me, manager, isOwner }: { slug: string; member: Member; me: string; manager: boolean; isOwner: boolean }) {
  const [edit, setEdit] = useState(false);
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState<OrgRole>(member.role);
  const [status, setStatus] = useState(member.status);
  const [lastDay, setLastDay] = useState(member.lastDay ?? "");
  const { busy, error, run } = useAction();
  const self = member.login === me.toLowerCase();
  const canEdit = manager || self;
  const statusLabel = status === "active" ? "label-success" : status === "leaving" ? "label-attention" : "label-muted";
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Avatar name={member.name} email={member.email ?? member.login} size={28} gone={member.status === "left"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{member.name} <span className="font-normal text-fg-muted">@{member.login}</span></p>
        {!edit ? (
          <p className="truncate text-[12px] text-fg-muted">{member.email ? <span className="font-mono">{member.email}</span> : <span className="text-attention">no git email set, commits cannot be matched</span>}{member.lastDay ? ` · last day ${member.lastDay}` : ""}</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input w-64 font-mono text-[12px]" placeholder="git author email (e.g. name@gmail.com)" />
            {manager && (
              <>
                <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} className="input w-auto text-[12px]" disabled={!isOwner && (member.role === "owner" || role === "owner")}>
                  <option value="member">member</option><option value="manager">manager</option>{isOwner && <option value="owner">owner</option>}
                </select>
                <select value={status} onChange={(e) => setStatus(e.target.value as Member["status"])} className="input w-auto text-[12px]">
                  <option value="active">active</option><option value="leaving">leaving</option><option value="left">left</option>
                </select>
                <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className="input w-auto text-[12px]" title="last day" />
              </>
            )}
          </div>
        )}
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
      <span className="label label-muted">{member.role}</span>
      <span className={`label ${statusLabel}`}>{status}</span>
      {canEdit && !edit && <button onClick={() => setEdit(true)} className="btn btn-sm">Edit</button>}
      {edit && (
        <>
          <button onClick={() => run(() => call(`/api/org/${slug}/members`, "PATCH", { login: member.login, email, role, status, lastDay }), () => setEdit(false))} disabled={busy} className="btn btn-sm btn-primary">{busy ? "Saving…" : "Save"}</button>
          <button onClick={() => setEdit(false)} className="btn btn-sm btn-invisible">Cancel</button>
        </>
      )}
      {manager && !self && !edit && (
        <button onClick={() => { if (confirm(`Remove @${member.login} from the organisation?`)) run(() => call(`/api/org/${slug}/members?login=${member.login}`, "DELETE")); }} className="btn btn-sm btn-invisible text-fg-muted" title="Remove"><Octicon name="people" className="h-3.5 w-3.5" /></button>
      )}
    </li>
  );
}

export function NoticeComposer({ slug, members, templates, repos }: { slug: string; members: Member[]; templates: Record<NoticeType, { label: string; subject: string; body: string }>; repos: string[] }) {
  const [to, setTo] = useState(members[0]?.login ?? "");
  const [type, setType] = useState<NoticeType>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [repo, setRepo] = useState(repos[0] ?? "");
  const { busy, error, run } = useAction();
  const tpl = templates[type];
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => call(`/api/org/${slug}/notices`, "POST", { toLogin: to, type, subject: subject || undefined, body: body || undefined, message, repo }), () => { setSubject(""); setBody(""); setMessage(""); }); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[12px] text-fg-muted">To
          <select value={to} onChange={(e) => setTo(e.target.value)} className="input mt-1">{members.map((m) => <option key={m.login} value={m.login}>{m.name} (@{m.login})</option>)}</select>
        </label>
        <label className="text-[12px] text-fg-muted">Type
          <select value={type} onChange={(e) => setType(e.target.value as NoticeType)} className="input mt-1">{(Object.keys(templates) as NoticeType[]).map((k) => <option key={k} value={k}>{templates[k].label}</option>)}</select>
        </label>
        <label className="text-[12px] text-fg-muted">Repository (for {"{repo}"})
          <select value={repo} onChange={(e) => setRepo(e.target.value)} className="input mt-1">{repos.length ? repos.map((r) => <option key={r} value={r}>{r.replace(/^https?:\/\/(www\.)?github\.com\//i, "")}</option>) : <option value="">(none linked)</option>}</select>
        </label>
      </div>
      <label className="block text-[12px] text-fg-muted">Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input mt-1" placeholder={tpl.subject} />
      </label>
      {(type === "general" || type === "warning") && (
        <label className="block text-[12px] text-fg-muted">Message (fills {"{message}"})
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="input mt-1" placeholder="What do you want to say?" />
        </label>
      )}
      <label className="block text-[12px] text-fg-muted">Body (leave empty to use the template; placeholders: {"{name} {org} {lastDay} {repo} {message}"})
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="input mt-1 font-mono text-[12px]" placeholder={tpl.body} />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || !to} className="btn btn-primary">{busy ? "Sending…" : "Send notice"}</button>
        <span className="text-[11px] text-fg-subtle">Delivered to their inbox in Ghost-Architect, with read and acknowledge tracking. Printable as a letter.</span>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </form>
  );
}

export function HandoverCreator({ slug, members, repos }: { slug: string; members: Member[]; repos: string[] }) {
  const [repo, setRepo] = useState(repos[0] ?? "");
  const [leaver, setLeaver] = useState(members.find((m) => m.status === "leaving")?.login ?? members[0]?.login ?? "");
  const [receiver, setReceiver] = useState(members.find((m) => m.login !== leaver)?.login ?? "");
  const [due, setDue] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => call(`/api/org/${slug}/handovers`, "POST", { repoUrl: repo, leaverLogin: leaver, receiverLogin: receiver, dueDate: due || undefined })); }} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
      <label className="text-[12px] text-fg-muted">Repository
        <select value={repo} onChange={(e) => setRepo(e.target.value)} className="input mt-1">{repos.map((r) => <option key={r} value={r}>{r.replace(/^https?:\/\/(www\.)?github\.com\//i, "")}</option>)}</select>
      </label>
      <label className="text-[12px] text-fg-muted">Leaving
        <select value={leaver} onChange={(e) => setLeaver(e.target.value)} className="input mt-1">{members.map((m) => <option key={m.login} value={m.login}>{m.name}{m.status === "leaving" ? " (leaving)" : ""}</option>)}</select>
      </label>
      <label className="text-[12px] text-fg-muted">Receiving
        <select value={receiver} onChange={(e) => setReceiver(e.target.value)} className="input mt-1">{members.filter((m) => m.login !== leaver).map((m) => <option key={m.login} value={m.login}>{m.name}</option>)}</select>
      </label>
      <label className="text-[12px] text-fg-muted">Due
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input mt-1 w-auto" />
      </label>
      <button type="submit" disabled={busy || !repo || !leaver || !receiver} className="btn btn-primary">{busy ? "Creating…" : "Create handover"}</button>
      {error && <p className="text-[12px] text-danger sm:col-span-5">{error}</p>}
    </form>
  );
}

export function SupportAccessToggle({ slug, enabled, changedAt, changedBy }: { slug: string; enabled: boolean; changedAt?: string; changedBy?: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => { const next = !enabled; if (!next || confirm("Grant platform admins read access to this organisation's repositories, logs, notices and handovers? This is recorded in the audit log. You can revoke it any time.")) run(() => call(`/api/org/${slug}/settings`, "PATCH", { supportAccess: next })); }} disabled={busy} className={`btn ${enabled ? "" : "btn-primary"}`}>
        {busy ? "Saving…" : enabled ? "Revoke support access" : "Grant support access"}
      </button>
      <span className={`label ${enabled ? "label-attention" : "label-success"}`}>{enabled ? "admins can view this organisation" : "private: admins see nothing"}</span>
      {changedAt && <span className="text-[11px] text-fg-subtle">changed {changedAt.slice(0, 10)} by @{changedBy}</span>}
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </div>
  );
}

export function RenameOrg({ slug, name }: { slug: string; name: string }) {
  const [v, setV] = useState(name);
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => call(`/api/org/${slug}/settings`, "PATCH", { name: v })); }} className="flex items-end gap-2">
      <label className="flex-1 text-[12px] text-fg-muted">Name<input value={v} onChange={(e) => setV(e.target.value)} className="input mt-1" /></label>
      <button type="submit" disabled={busy || v.trim().length < 2 || v === name} className="btn">Rename</button>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </form>
  );
}
