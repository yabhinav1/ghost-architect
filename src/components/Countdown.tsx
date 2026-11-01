import type { Handover } from "@/lib/types";

import { addDays, dayDiff, isoDay as iso } from "@/lib/dates";

export type CountdownItem = { date: string; label: string; kind: "due" | "last" | "done" };

/**
 * A leaver's calendar: every day from the start of this week until the last day (or the latest due date),
 * with open handovers marked on their due dates. Weeks run Monday to Sunday.
 */
export function Countdown({ name, lastDay, handovers, today = iso(new Date()), compact = false }: { name: string; lastDay?: string; handovers: Pick<Handover, "id" | "repoUrl" | "dueDate" | "status" | "files" | "completedAt">[]; today?: string; compact?: boolean }) {
  const open = handovers.filter((h) => h.status === "open");
  const dues = handovers.map((h) => h.dueDate).filter((d): d is string => Boolean(d));
  const end = [lastDay, ...dues].filter((d): d is string => Boolean(d)).sort().at(-1);
  const openFiles = open.reduce((n, h) => n + h.files.filter((f) => !f.done).length, 0);
  const daysLeft = lastDay ? dayDiff(today, lastDay) : null;
  if (!end) {
    return <div className="px-4 py-3 text-[12px] text-fg-muted">No last day or due date set for {name}. A manager can set the last day on the members page.</div>;
  }
  // start on the Monday of this week; show at least two weeks and at most ten
  const todayDow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(today, -todayDow);
  const span = Math.max(13, Math.min(69, dayDiff(start, end) + (6 - ((dayDiff(start, end) + todayDow) % 7)) ));
  const days: string[] = [];
  for (let i = 0; i <= span; i++) days.push(addDays(start, i));
  const marks = new Map<string, CountdownItem[]>();
  for (const h of handovers) {
    const repo = h.repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
    if (h.dueDate) marks.set(h.dueDate, [...(marks.get(h.dueDate) ?? []), { date: h.dueDate, label: `${repo} due`, kind: h.status === "complete" ? "done" : "due" }]);
    if (h.completedAt) { const d = h.completedAt.slice(0, 10); marks.set(d, [...(marks.get(d) ?? []), { date: d, label: `${repo} completed`, kind: "done" }]); }
  }
  if (lastDay) marks.set(lastDay, [...(marks.get(lastDay) ?? []), { date: lastDay, label: `${name}'s last day`, kind: "last" }]);
  const overdue = open.filter((h) => h.dueDate && h.dueDate < today).length;
  const tone = daysLeft === null ? "label-muted" : daysLeft < 0 ? "label-muted" : daysLeft <= 7 ? "label-danger" : daysLeft <= 21 ? "label-attention" : "label-accent";
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className={compact ? "px-4 py-3" : "p-4"}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-[13px]">
          <span className={`label ${tone} mr-2`}>{daysLeft === null ? "no last day" : daysLeft < 0 ? `left ${-daysLeft}d ago` : daysLeft === 0 ? "last day today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</span>
          <span className="font-semibold">{name}</span>{lastDay && <span className="text-fg-muted"> leaves {lastDay}</span>}
        </p>
        <p className="text-[12px] text-fg-muted">{open.length} open handover{open.length === 1 ? "" : "s"} · {openFiles} file{openFiles === 1 ? "" : "s"} not walked through{overdue ? <span className="text-danger"> · {overdue} overdue</span> : null}</p>
      </div>
      <div className="mt-3 grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-[10px] text-fg-subtle">
        <span />
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="text-center">{d}</span>)}
        {weeks.map((w) => (
          <Week key={w[0]} days={w} today={today} lastDay={lastDay} marks={marks} />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-[12px]">
        {[...marks.entries()].sort(([a], [b]) => a.localeCompare(b)).filter(([d]) => d >= today || d === lastDay).slice(0, 6).map(([d, items]) => (
          <li key={d} className="flex items-center gap-2">
            <span className="w-20 font-mono text-fg-muted">{d.slice(5)}</span>
            <span className="text-fg-subtle">{dayDiff(today, d) === 0 ? "today" : dayDiff(today, d) > 0 ? `in ${dayDiff(today, d)}d` : `${-dayDiff(today, d)}d ago`}</span>
            {items.map((it) => <span key={it.label} className={`label ${it.kind === "last" ? "label-danger" : it.kind === "done" ? "label-success" : "label-attention"}`}>{it.label}</span>)}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-3 text-[10px] text-fg-subtle">
        <Key className="bg-canvas-subtle border-border-muted" label="past" /><Key className="bg-accent-muted border-accent" label="today" /><Key className="bg-canvas border-border" label="working day" /><Key className="bg-attention-muted border-attention" label="handover due" /><Key className="bg-danger-muted border-danger" label="last day" /><Key className="opacity-30 border-border-muted" label="after they leave" />
      </p>
    </div>
  );
}

function Week({ days, today, lastDay, marks }: { days: string[]; today: string; lastDay?: string; marks: Map<string, CountdownItem[]> }) {
  const label = `${days[0].slice(5)}`;
  return (
    <>
      <span className="pr-1 pt-1 font-mono text-fg-subtle">{label}</span>
      {days.map((d) => {
        const items = marks.get(d) ?? [];
        const past = d < today;
        const isToday = d === today;
        const after = lastDay ? d > lastDay : false;
        const weekend = [5, 6].includes(days.indexOf(d));
        const kinds = new Set(items.map((i) => i.kind));
        const cls = kinds.has("last") ? "border-danger bg-danger-muted text-danger"
          : kinds.has("due") ? "border-attention bg-attention-muted text-attention"
          : kinds.has("done") ? "border-success bg-success-muted text-success"
          : isToday ? "border-accent bg-accent-muted text-fg"
          : after ? "border-border-muted opacity-30"
          : past ? "border-border-muted bg-canvas-subtle text-fg-subtle"
          : weekend ? "border-border-muted text-fg-subtle"
          : "border-border bg-canvas text-fg-muted";
        return (
          <span key={d} title={items.length ? `${d}: ${items.map((i) => i.label).join(", ")}` : d} className={`flex h-7 items-center justify-center rounded border text-[10px] tabular-nums ${cls} ${isToday ? "ring-1 ring-accent" : ""}`}>
            {d.slice(8).replace(/^0/, "")}
          </span>
        );
      })}
    </>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block h-2.5 w-2.5 rounded-sm border ${className}`} />{label}</span>;
}
