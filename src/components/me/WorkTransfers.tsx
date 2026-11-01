"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useInbox } from "@/components/InboxFeed";
import type { WorkTransfer } from "@/lib/types";

export function TransferComposer({ organisations }: { organisations: { id: string; name: string }[] }) {
  const { refresh } = useInbox();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [open, setOpen] = useState(false);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError(""); setSent(false);
    try {
      const response = await fetch("/api/me/transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        recipientEmail: fields.get("recipientEmail"), title: fields.get("title"), repoUrl: fields.get("repoUrl"),
        branch: fields.get("branch"), notes: fields.get("notes"), ...(orgId ? { orgId } : {}),
        access: fields.get("access") || "none", ownership: fields.get("ownership") === "on",
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send handoff.");
      form.reset(); setOrgId(""); setSent(true); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send handoff."); }
    finally { setBusy(false); }
  }
  return <section id="send-work" className="card scroll-mt-20">
    <div className="card-header">Transfer unfinished work<button type="button" onClick={() => setOpen((o) => !o)} className={`btn btn-sm ml-auto ${open ? "" : "btn-primary"}`} aria-expanded={open}>{open ? "Close" : "New handoff"}</button></div>
    {!open && sent && <p role="status" className="px-4 pt-3 text-[13px] text-success">Handoff sent. It is emailed to the recipient and waits in their inbox here. Track it under Sent.</p>}
    {!open && <p className="px-4 py-3 text-[13px] text-fg-muted">Send repository details, progress and next steps to a developer or an organisation. Optionally add them as a collaborator or transfer the repository on GitHub when they accept.</p>}
    {open && <form className="space-y-3 p-4 text-sm" onSubmit={send}>
      <p className="text-fg-muted">Send repository details, progress and next steps to a developer or an organisation representative.</p>
      <label className="block">Send to<select className="input mt-1 w-full" value={orgId} onChange={(event) => setOrgId(event.target.value)} disabled={busy}><option value="">A developer</option>{organisations.map((org) => <option key={org.id} value={org.id}>{org.name} · owner or manager</option>)}</select></label>
      <label className="block">{orgId ? "Organisation owner or manager’s email" : "Recipient’s email"}<input className="input mt-1 w-full" name="recipientEmail" type="email" maxLength={254} placeholder="teammate@company.com" required disabled={busy} /></label>
      <p className="text-xs text-fg-muted">Use an email verified on their GitHub account. They get an email with the details when the host has mail set up, and the handoff waits in their inbox here once they sign in with that address.{orgId && " The recipient must also be an owner or manager of this organisation."}</p>
      <label className="block">Work title<input className="input mt-1 w-full" name="title" maxLength={200} placeholder="Finish the billing migration" required disabled={busy} /></label>
      <label className="block">GitHub repository<input className="input mt-1 w-full" name="repoUrl" type="url" maxLength={500} placeholder="https://github.com/team/project" required disabled={busy} /></label>
      <label className="block">Branch or pull request reference <span className="text-fg-muted">(optional)</span><input className="input mt-1 w-full" name="branch" maxLength={200} placeholder="feature/billing or PR #42" disabled={busy} /></label>
      <label className="block">Handoff notes<textarea className="input mt-1 min-h-36 w-full" name="notes" maxLength={20000} placeholder="What is done? What remains? Include relevant files, blockers, setup instructions and links." required disabled={busy} /></label>
      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">GitHub access when they accept</legend>
        <label className="block">Add them as a collaborator<select className="input mt-1 w-full" name="access" defaultValue="push" disabled={busy}><option value="none">No GitHub change, just the notes</option><option value="push">Write access (push code, open pull requests)</option><option value="admin">Admin access (manage settings and collaborators)</option></select></label>
        <label className="mt-3 flex items-start gap-2"><input type="checkbox" name="ownership" className="check mt-1" disabled={busy} /><span>Transfer repository ownership to them on GitHub<span className="block text-xs text-fg-muted">For repositories you personally own. GitHub emails the new owner; the move completes when they accept, within one day. You keep access as a collaborator.</span></span></label>
        <p className="mt-2 text-xs text-fg-muted">These run automatically the moment the recipient accepts, using the admin access you have now. You need admin on the repository for either; organisation policy can still block invitations.</p>
      </fieldset>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {sent && <p role="status" className="text-success">Handoff saved. It will appear in the recipient’s inbox when they sign in with the matching verified GitHub email. Track it below.</p>}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 border-t border-border bg-canvas px-4 py-3"><button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send work handoff"}</button><button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button></div>
    </form>}
  </section>;
}

function TransferCard({ transfer: t }: { transfer: WorkTransfer & { incoming: boolean } }) {
  const { refresh } = useInbox();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unread = t.incoming ? !t.recipientReadAt : !t.senderReadAt;
  async function act(action: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/me/transfers/${t.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update handoff.");
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update handoff."); }
    finally { setBusy(false); }
  }
  return <article id={`transfer-${t.id}`} className={`card scroll-mt-20 ${unread ? "!border-accent/60" : ""}`}>
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><button className="text-left font-semibold text-accent hover:underline" aria-expanded={open} disabled={busy} onClick={() => { setOpen(!open); if (!open && unread) void act("read"); }}>{unread && "● "}{t.title}</button><span className={`label ${t.status === "accepted" ? "label-success" : "label-muted"}`}>{t.status}</span></div>
      <p className="mt-1 break-words text-xs text-fg-muted">{t.incoming ? `From @${t.senderLogin}` : `To ${t.recipientEmail}`}{t.orgName && ` · ${t.orgName}`} · {new Date(t.createdAt).toLocaleDateString()}</p>
      {!t.incoming && t.status === "pending" && <p className="mt-2 text-xs text-fg-muted">{t.recipientLogin ? `Opened by @${t.recipientLogin}; awaiting a decision.` : "Awaiting the recipient’s verified sign-in and review."}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {open && <div className="mt-4 space-y-3 text-sm">
        <a className="break-all text-accent hover:underline" href={t.repoUrl} target="_blank" rel="noreferrer">{t.repoUrl} ↗</a>
        {t.branch && <p className="break-words text-fg-muted">Branch / PR: {t.branch}</p>}
        <p className="whitespace-pre-wrap break-words rounded-md bg-canvas-subtle p-3">{t.notes}</p>
        {t.grant && (t.grant.access !== "none" || t.grant.ownership) && t.status === "pending" && <p className="text-xs text-fg-muted">On acceptance: {[t.grant.access !== "none" ? `collaborator with ${t.grant.access === "admin" ? "admin" : "write"} access` : null, t.grant.ownership ? "repository ownership transferred on GitHub" : null].filter(Boolean).join(" and ")}.</p>}
        {(!t.grant || (t.grant.access === "none" && !t.grant.ownership)) && t.status === "pending" && <p className="text-xs text-fg-muted">Accepting records responsibility for this handoff. No GitHub access changes were requested.</p>}
        <div className="flex flex-wrap gap-2">
          {t.incoming && t.status === "pending" && <><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act("accept")}>Accept handoff</button><button className="btn btn-sm" disabled={busy} onClick={() => act("decline")}>Decline</button></>}
          {!t.incoming && t.status === "pending" && <button className="btn btn-sm" disabled={busy} onClick={() => act("cancel")}>Cancel handoff</button>}
          {!t.incoming && t.status === "accepted" && (!t.githubAccess || t.githubAccess === "failed") && <button className="btn btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Invite @${t.recipientLogin} with ${t.grant?.access === "admin" ? "ADMIN" : "WRITE"} access to ${t.repoUrl}? GitHub must permit you to manage repository access.`)) void act("invite"); }}>{t.githubAccess === "failed" ? "Retry: add" : "Add"} @{t.recipientLogin} as collaborator</button>}
          {!t.incoming && t.status === "accepted" && t.ownership !== "requested" && <button className="btn btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Transfer ownership of ${t.repoUrl} to @${t.recipientLogin} on GitHub? GitHub will email them; the repository moves when they accept. This cannot be undone from here.`)) void act("transfer-ownership"); }}>{t.ownership === "failed" ? "Retry: transfer ownership" : "Transfer ownership on GitHub"}</button>}
          {t.incoming && t.ownership === "requested" && <a href="https://github.com/notifications" target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">Accept the ownership transfer on GitHub ↗</a>}
          {!t.incoming && <a href={`${t.repoUrl}/settings/access`} target="_blank" rel="noreferrer" className="btn btn-sm">Manage access on GitHub ↗</a>}
          {t.incoming && t.githubAccess === "invited" && <a href={`${t.repoUrl}/invitations`} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">Review GitHub invitation ↗</a>}
          {unread && <button className="btn btn-sm" disabled={busy} onClick={() => act("read")}>Mark read</button>}
        </div>
        {t.githubAccess && t.githubAccess !== "failed" && <p className="text-xs text-success">{t.githubAccess === "invited" ? `GitHub sent @${t.recipientLogin} a collaborator invitation (${t.grant?.access === "admin" ? "admin" : "write"} access). It must be accepted on GitHub.` : "GitHub confirmed the collaborator access."} Current access is managed on GitHub.</p>}
        {t.ownership === "requested" && <p className="text-xs text-success">Ownership transfer requested on GitHub. @{t.recipientLogin} has one day to accept it from GitHub&rsquo;s email; until then the repository stays where it is.</p>}
        {t.grantError && <p className="text-xs text-danger">GitHub step failed: {t.grantError}</p>}
        {busy && <p role="status" className="text-xs text-fg-muted">Updating…</p>}
      </div>}
    </div>
  </article>;
}

export function WorkTransfers() {
  const { data, error, refresh } = useInbox();
  const lastAnchor = useRef("");
  useEffect(() => {
    const scroll = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#transfer-") || lastAnchor.current === hash) return;
      const element = document.getElementById(hash.slice(1));
      if (element) { element.scrollIntoView({ block: "start" }); lastAnchor.current = hash; }
    };
    scroll(); window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [data]);
  return <section className="space-y-3" aria-label="Work handoffs">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Work handoffs</h2><button className="btn btn-sm" onClick={refresh}>Refresh</button></div>
    {data?.emailWarning && <p role="status" className="rounded-md border border-attention/40 bg-attention-muted p-3 text-sm">{data.emailWarning} <a href="/api/auth/login" className="text-accent underline">Reconnect GitHub</a></p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!data && !error && <p className="text-sm text-fg-muted">Loading handoffs…</p>}
    {data && ([true, false] as const).map((incoming) => <div key={String(incoming)} className="space-y-3"><h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{incoming ? "Received" : "Sent"}</h3>{data.transfers.filter((t) => t.incoming === incoming).map((t) => <TransferCard key={t.id} transfer={t} />)}{!data.transfers.some((t) => t.incoming === incoming) && <p className="card p-4 text-sm text-fg-muted">{incoming ? "No work handoffs received yet. Ask the sender to use an email verified on your GitHub account." : "No handoffs sent yet. Use Transfer unfinished work to send one."}</p>}</div>)}
  </section>;
}
