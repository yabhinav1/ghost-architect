"use client";

import { useMemo } from "react";

const MONTH_MS = 30.44 * 24 * 3600 * 1000;

/** Commits per month for the last N months, as tiny bars. Departed authors' commits are shown in red. */
/** `until` is the analysis timestamp, so the chart is a pure function of its inputs. */
export function Sparkline({ timeline, departed, until, months = 12 }: { timeline: { d: string; a: string }[]; departed: Set<string>; until: string; months?: number }) {
  const bars = useMemo(() => {
    const now = Date.parse(until);
    const out = Array.from({ length: months }, () => ({ all: 0, gone: 0 }));
    for (const c of timeline ?? []) {
      const age = Math.floor((now - Date.parse(c.d)) / MONTH_MS);
      if (age < 0 || age >= months) continue;
      const slot = out[months - 1 - age];
      slot.all++;
      if (departed.has(c.a)) slot.gone++;
    }
    return out;
  }, [timeline, departed, until, months]);
  const max = Math.max(1, ...bars.map((b) => b.all));
  const total = bars.reduce((s, b) => s + b.all, 0);
  const W = 160;
  const H = 28;
  const bw = W / months;
  return (
    <div className="flex items-center gap-2" title={`${total} commits in the last ${months} months; red = by departed authors`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        {bars.map((b, i) => {
          const h = (b.all / max) * (H - 2);
          const hg = (b.gone / max) * (H - 2);
          return (
            <g key={i}>
              <rect x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx="1" fill="#30363d" />
              {hg > 0 && <rect x={i * bw + 1} y={H - hg} width={bw - 2} height={hg} rx="1" fill="#da3633" />}
            </g>
          );
        })}
      </svg>
      <span className="text-[10px] text-fg-subtle">{months}m</span>
    </div>
  );
}
