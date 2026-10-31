"use client";

import { useMemo, useState } from "react";
import { activityWindow, utcDay } from "@/lib/activity";
import type { Analysis } from "@/lib/types";

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function CommitActivity({ analysis, departed }: { analysis: Analysis; departed: Set<string> }) {
  const [range, setRange] = useState(30);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [selected, setSelected] = useState<string | null>(null);
  const summary = useMemo(() => activityWindow(analysis, range, departed), [analysis, range, departed]);
  const max = Math.max(1, ...summary.days.map((day) => day.commits));
  const active = summary.days.find((day) => day.date === selected) ?? [...summary.days].reverse().find((day) => day.commits > 0) ?? summary.days[summary.days.length - 1];
  const recent = (analysis.commits ?? []).filter((commit) => utcDay(commit.date) === active.date);
  const leavers = departed.size > 0;

  return (
    <section className="card overflow-hidden" aria-labelledby="commit-activity-title" data-tour="activity">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="mr-auto"><h2 id="commit-activity-title" className="text-[14px] font-semibold">Commit activity</h2><p className="mt-0.5 text-[11px] text-fg-muted">Daily history · default branch · UTC</p></div>
        <div className="segmented" role="group" aria-label="Activity period">
          {[7, 30, 90].map((days) => <button key={days} onClick={() => setRange(days)} data-active={range === days} aria-pressed={range === days}>{days} days</button>)}
        </div>
        <div className="segmented" role="group" aria-label="Activity display">
          {(["chart", "table"] as const).map((mode) => <button key={mode} onClick={() => setView(mode)} data-active={view === mode} aria-pressed={view === mode} className="capitalize">{mode}</button>)}
        </div>
      </header>

      {summary.partial && <p className="border-b border-attention/30 bg-attention-muted px-4 py-2 text-[12px] text-attention">Limited cached history: these counts use the saved recent commits and may be incomplete. Use the repository refresh button for complete daily totals.</p>}

      <dl className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-4">
        {[["Commits", summary.commits], ["Active days", `${summary.activeDays} / ${range}`], ["Contributors", summary.contributors], ["From selected leavers", summary.departedCommits]].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border-muted bg-canvas-subtle px-3 py-2"><dt className="text-[10px] text-fg-muted">{label}</dt><dd className={`mt-0.5 text-xl font-semibold ${label === "From selected leavers" && leavers ? "text-danger" : ""}`}>{value}</dd></div>
        ))}
      </dl>

      {view === "chart" ? (
        <div className="px-4 pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-fg-muted"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-accent" />{leavers ? "Other authors" : "All authors"}</span>{leavers && <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-danger" />Selected leavers</span>}<span className="ml-auto">Select a day for its commits</span></div>
          <div className="overflow-x-auto pb-2">
            <figure className={range === 90 ? "min-w-[640px]" : "min-w-[340px]"}>
              <figcaption className="sr-only">{summary.commits} commits over {range} days. The table view provides the same daily counts.</figcaption>
              <div className="flex gap-2">
                <div className="flex h-40 w-7 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-fg-subtle"><span>{max}</span><span>0</span></div>
                <div className="relative flex h-40 flex-1 gap-[3px] border-b border-border" role="group" aria-label="Daily commit counts">
                  <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border-muted" />
                  <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border-muted" />
                  {summary.days.map((day) => (
                    <button key={day.date} onClick={() => setSelected(day.date)} onFocus={() => setSelected(day.date)} title={`${day.date}: ${day.commits} commits, ${day.contributors} contributors${leavers ? `, ${day.departedCommits} from selected leavers` : ""}`} aria-label={`${day.date}: ${day.commits} commits`} aria-pressed={active.date === day.date} className={`relative flex h-full min-w-0 flex-1 items-end rounded-t-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active.date === day.date ? "bg-accent/10" : "hover:bg-canvas-subtle"}`}>
                      <span className={`relative block w-full overflow-hidden rounded-t-sm ${day.commits ? "bg-accent/80" : "bg-border"}`} style={{ height: day.commits ? `${day.commits / max * 100}%` : "2px" }}>
                        {day.departedCommits > 0 && <span className="absolute inset-x-0 bottom-0 bg-danger" style={{ height: `${day.departedCommits / day.commits * 100}%` }} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ml-9 mt-2 flex justify-between text-[10px] text-fg-muted"><span>{dateLabel(summary.days[0].date)}</span><span>{dateLabel(summary.days[Math.floor(range / 2)].date)}</span><span>{dateLabel(summary.days[range - 1].date)}</span></div>
            </figure>
          </div>
          {summary.commits === 0 && <p className="py-2 text-center text-[12px] text-fg-muted">No commits recorded in this window. Try a longer period or refresh the analysis.</p>}
        </div>
      ) : (
        <div className="mt-4 max-h-72 overflow-auto">
          <table className="w-full text-[12px] tabular-nums"><caption className="sr-only">Daily commit activity in UTC, newest first</caption><thead className="sticky top-0 bg-canvas-subtle text-left text-fg-muted"><tr><th scope="col" className="px-4 py-2">Date (UTC)</th><th scope="col" className="px-2 py-2 text-right">Commits</th><th scope="col" className="px-2 py-2 text-right">Contributors</th><th scope="col" className="px-4 py-2 text-right">Selected leavers</th></tr></thead>
            <tbody>{[...summary.days].reverse().map((day) => <tr key={day.date} className={`border-t border-border-muted ${active.date === day.date ? "bg-accent/10" : ""}`}><td className="px-4 py-2"><button onClick={() => setSelected(day.date)} className="text-accent hover:underline" aria-label={`Show commits from ${day.date}`}>{day.date}</button></td><td className="px-2 py-2 text-right">{day.commits}</td><td className="px-2 py-2 text-right">{day.contributors}</td><td className="px-4 py-2 text-right">{day.departedCommits}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      <div className="mx-4 mt-3 rounded-md border border-border-muted bg-canvas-subtle px-3 py-2">
        <p className="text-[12px]" aria-live="polite"><b>{dateLabel(active.date)}</b> · {active.commits} commits · {active.contributors} contributors{leavers ? ` · ${active.departedCommits} from selected leavers` : ""}</p>
        {recent.length > 0 && <ul className="mt-2 space-y-1">{recent.slice(0, 5).map((commit) => <li key={commit.sha} className="flex min-w-0 gap-2 text-[11px]"><a href={`${analysis.repoUrl}/commit/${commit.sha}`} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-accent hover:underline">{commit.sha.slice(0, 7)}</a><span className="truncate" title={commit.subject}>{commit.subject}</span><span className="ml-auto shrink-0 text-fg-muted">{commit.name}</span></li>)}</ul>}
        {active.commits > Math.min(recent.length, 5) && <p className="mt-1 text-[10px] text-fg-subtle">Showing {Math.min(recent.length, 5)} commit details from the recent history snapshot{summary.partial ? ". Refresh for complete daily totals." : "; daily totals include the full scan."}</p>}
      </div>
      <p className="px-4 py-3 text-[11px] leading-relaxed text-fg-subtle">Snapshot: {utcDay(analysis.analyzedAt)}. Refresh the repository to pick up new commits. Dates use Git author timestamps; contributors are counted by email. Commit volume shows activity, not whether work is finished or how valuable it is.</p>
    </section>
  );
}
