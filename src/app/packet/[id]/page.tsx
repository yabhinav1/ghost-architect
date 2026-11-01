import { MascotLoader } from "@/components/MascotLoader";
import { Suspense } from "react";
import { PrintButton } from "@/components/PrintButton";
import { ReadinessRing } from "@/components/ReadinessRing";
import { get } from "@/lib/db";
import { buildPacket, packetAccess, type Packet, type PacketFile } from "@/lib/packet";
import { getSession } from "@/lib/session";
import type { Handover } from "@/lib/types";

export const metadata = { title: "Day-one packet" };

const repoName = (url: string) => url.replace(/^https?:\/\/(www\.)?github\.com\//i, "");

/** Printable onboarding brief for the person inheriting the code. Light, paper-like, one page per file group. */
async function Body({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pending?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await getSession();
  const h = await get<Handover>("handovers", id);
  if (!h || !session || !(await packetAccess(h, session.login))) return <main className="mx-auto max-w-xl p-10 font-sans" style={{ colorScheme: "light" }}><p>This packet is not available to you.</p></main>;
  const p = await buildPacket(h, { token: session.token, withPending: sp.pending !== "0" });
  const done = p.files.filter((f) => f.done).length;
  const inFlight = p.pending ? p.pending.pullRequests.length + p.pending.issues.length + p.pending.branches.length + p.pending.todos.length : null;
  const daysLeft = p.daysLeft;
  return (
    <main className="min-h-screen bg-[#f6f8fa] font-sans text-[#1f2328] print:bg-white" style={{ colorScheme: "light" }}>
      <div className="mx-auto max-w-[860px] px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center gap-2 print:hidden">
          <a href={`/me#handover-${h.id}`} className="text-[13px] text-[#0969da] hover:underline">← back to handover</a>
          <span className="flex-1" />
          <a href={`/api/handover/${h.id}/packet?format=md`} className="rounded-md border border-[#d1d9e0] bg-white px-3 py-1 text-[12px] font-medium hover:bg-[#f3f4f6]">Download Markdown</a>
          <PrintButton className="rounded-md bg-[#1f883d] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#1a7f37]" />
        </div>

        <article className="rounded-xl border border-[#d1d9e0] bg-white shadow-sm print:border-0 print:shadow-none">
          <header className="border-b border-[#d1d9e0] px-8 pt-8 pb-6">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#59636e]">Day-one packet · {p.org.name}</p>
            <h1 className="mt-1 font-mono text-[26px] font-semibold leading-tight">{repoName(p.handover.repoUrl)}</h1>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
                <Person role="Leaving" name={p.leaver.name} login={p.leaver.login} sub={p.leaver.lastDay ? `last day ${p.leaver.lastDay}` : undefined} />
                <span className="text-[#8c959f]">→</span>
                <Person role="Taking over" name={p.receiver.name} login={p.receiver.login} sub={p.handover.dueDate ? `handover due ${p.handover.dueDate}` : undefined} />
              </div>
              <ReadinessRing score={p.readiness.score} label={p.readiness.label} size={92} light />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat value={`${done}/${p.files.length}`} label="files walked through" />
              <Stat value={inFlight === null ? "–" : String(inFlight)} label="items in flight" />
              <Stat value={p.quiz ? (p.quiz.best ? `${p.quiz.best.score}/${p.quiz.best.total}` : "0/" + p.quiz.questions) : "–"} label={p.quiz ? (p.quiz.passed ? "knowledge check passed" : "knowledge check") : "no knowledge check"} />
              <Stat value={daysLeft === null ? "–" : daysLeft < 0 ? "gone" : String(daysLeft)} label={daysLeft === null ? "last day not set" : daysLeft < 0 ? `left ${p.leaver.lastDay}` : "days until they leave"} />
            </div>
            {p.readiness.reasons.length > 0 && <p className="mt-3 text-[12px] text-[#59636e]">{p.readiness.reasons.join(" · ")}</p>}
          </header>

          <section className="border-b border-[#d1d9e0] px-8 py-6">
            <H2 n="1">Your first week</H2>
            <ol className="mt-3 space-y-2">
              {p.firstWeek.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-6">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d1d9e0] text-[11px] font-semibold text-[#59636e]">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="border-b border-[#d1d9e0] px-8 py-6">
            <H2 n="2">Files you now own <span className="ml-1 rounded-full bg-[#eaeef2] px-2 text-[12px] font-medium text-[#59636e]">{p.files.length}</span></H2>
            <div className="mt-3 space-y-3">
              {p.files.map((f) => <FileCard key={f.path} f={f} leaver={p.leaver.name} repoUrl={p.handover.repoUrl} />)}
              {p.files.length === 0 && <p className="text-[14px] text-[#59636e]">No files were listed on this handover.</p>}
            </div>
          </section>

          <section className="px-8 py-6">
            <H2 n="3">Work in flight</H2>
            {p.pending ? <Pending p={p} /> : <p className="mt-2 text-[13px] text-[#59636e]">{p.pendingError ? `Could not be computed: ${p.pendingError}` : "Skipped."}</p>}
          </section>

          <footer className="border-t border-[#d1d9e0] px-8 py-4 text-[11px] text-[#8c959f]">Compiled {p.generatedAt.slice(0, 16).replace("T", " ")} UTC by Ghost-Architect from the handover notes, cached briefs, git blame and GitHub. Re-open this page for a fresh copy.</footer>
        </article>
      </div>
    </main>
  );
}

function Person({ role, name, login, sub }: { role: string; name: string; login: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#8c959f]">{role}</p>
      <p className="font-semibold">{name} <span className="font-normal text-[#59636e]">@{login}</span></p>
      {sub && <p className="text-[12px] text-[#59636e]">{sub}</p>}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[#d1d9e0] bg-[#f6f8fa] px-3 py-2">
      <p className="text-[22px] font-semibold leading-tight tabular-nums">{value}</p>
      <p className="text-[12px] text-[#59636e]">{label}</p>
    </div>
  );
}

function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-2 text-[16px] font-semibold"><span className="font-mono text-[12px] text-[#8c959f]">{n}</span>{children}</h2>;
}

function FileCard({ f, leaver, repoUrl }: { f: PacketFile; leaver: string; repoUrl: string }) {
  const meta = [f.score !== undefined ? `criticality ${f.score}` : null, f.commits12m !== undefined ? `${f.commits12m} commits / 12 mo` : null, f.inbound !== undefined ? `${f.inbound} importers` : null].filter(Boolean);
  return (
    <div className="break-inside-avoid rounded-lg border border-[#d1d9e0]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#d1d9e0] bg-[#f6f8fa] px-4 py-2">
        <span className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${f.done ? "border-[#1a7f37] bg-[#1a7f37] text-white" : "border-[#8c959f] text-transparent"}`}>✓</span>
        <a href={`/r/${repoName(repoUrl)}?file=${encodeURIComponent(f.path)}`} className="font-mono text-[13px] font-medium text-[#0969da] hover:underline">{f.path}</a>
        {f.score !== undefined && f.score >= 60 && <span className="rounded-full border border-[#cf222e]/40 bg-[#ffebe9] px-2 text-[11px] text-[#cf222e]">high risk</span>}
        <span className="ml-auto text-[11px] text-[#8c959f]">{meta.join(" · ")}</span>
      </div>
      <div className="grid gap-x-6 gap-y-3 px-4 py-3 text-[13px] leading-5 sm:grid-cols-2">
        {f.purpose && <Para title="Why it exists">{f.purpose}</Para>}
        {f.notes.trim() ? <Para title={`${leaver}'s notes`}><span className="whitespace-pre-wrap">{f.notes.trim()}</span></Para> : <Para title={`${leaver}'s notes`}><span className="text-[#9a6700]">Nothing written yet. Ask before they go.</span></Para>}
        {f.risks.length > 0 && <List title="Risks" items={f.risks} tone="danger" />}
        {f.checklist.length > 0 && <List title="Before you change it" items={f.checklist} checkbox />}
        {f.undocumented.length > 0 && <List title="Nobody wrote down" items={f.undocumented} tone="attention" />}
        {(f.evidence.length > 0 || f.links.length > 0) && (
          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#59636e]">Evidence and links</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
              {f.evidence.map((e) => <a key={e.url} href={e.url} target="_blank" className="text-[#0969da] hover:underline">{e.title.slice(0, 60)} <span className="text-[#8c959f]">{e.date.slice(0, 10)}</span></a>)}
              {f.links.map((l) => <a key={l} href={l} target="_blank" className="text-[#0969da] hover:underline">{l.replace(/^https?:\/\//, "").slice(0, 50)}</a>)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Para({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-wide text-[#59636e]">{title}</p><p className="mt-1">{children}</p></div>;
}

function List({ title, items, tone, checkbox }: { title: string; items: string[]; tone?: "danger" | "attention"; checkbox?: boolean }) {
  const dot = tone === "danger" ? "bg-[#cf222e]" : tone === "attention" ? "bg-[#9a6700]" : "bg-[#8c959f]";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#59636e]">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((it) => <li key={it} className="flex gap-2">{checkbox ? <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-[#8c959f]" /> : <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}<span>{it}</span></li>)}
      </ul>
    </div>
  );
}

function Pending({ p }: { p: Packet }) {
  const d = p.pending!;
  const groups = [
    { title: "Open pull requests they authored", items: d.pullRequests.map((x) => ({ key: x.url, main: <a href={x.url} target="_blank" className="text-[#0969da] hover:underline">#{x.number} {x.title}</a>, sub: `updated ${x.updatedAt.slice(0, 10)}` })) },
    { title: "Open issues assigned to them", items: d.issues.map((x) => ({ key: x.url, main: <a href={x.url} target="_blank" className="text-[#0969da] hover:underline">#{x.number} {x.title}</a>, sub: `updated ${x.updatedAt.slice(0, 10)}` })) },
    { title: "Branches only they pushed", items: d.branches.map((b) => ({ key: b.name, main: <span className="font-mono">{b.name}</span>, sub: `${b.unmerged} unmerged · last ${b.lastCommit.slice(0, 10)}` })) },
    { title: "TODO / FIXME they wrote", items: d.todos.map((t) => ({ key: `${t.file}:${t.line}`, main: <><span className="font-mono text-[#59636e]">{t.file}:{t.line}</span> {t.text}</>, sub: t.date })) },
  ];
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.title} className="break-inside-avoid rounded-lg border border-[#d1d9e0]">
          <p className="flex items-center gap-2 border-b border-[#d1d9e0] bg-[#f6f8fa] px-3 py-1.5 text-[12px] font-semibold">{g.title}<span className={`ml-auto rounded-full px-2 text-[11px] ${g.items.length ? "bg-[#fff8c5] text-[#9a6700]" : "bg-[#eaeef2] text-[#59636e]"}`}>{g.items.length}</span></p>
          <ul className="divide-y divide-[#eaeef2] text-[13px]">
            {g.items.slice(0, 12).map((it) => <li key={it.key} className="px-3 py-1.5"><div>{it.main}</div><div className="text-[11px] text-[#8c959f]">{it.sub}</div></li>)}
            {g.items.length === 0 && <li className="px-3 py-2 text-[12px] text-[#8c959f]">nothing open</li>}
            {g.items.length > 12 && <li className="px-3 py-1.5 text-[12px] text-[#8c959f]">and {g.items.length - 12} more</li>}
          </ul>
        </div>
      ))}
      {d.notes.map((n) => <p key={n} className="text-[12px] text-[#8c959f] sm:col-span-2">{n}</p>)}
    </div>
  );
}

export default function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ pending?: string }> }) {
  return <Suspense fallback={<MascotLoader />}><Body {...props} /></Suspense>;
}
