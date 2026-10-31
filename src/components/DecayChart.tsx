"use client";

import { useMemo } from "react";
import { decayCurve } from "@/lib/insights";
import type { FileStat } from "@/lib/types";

export function DecayChart({ files, email, name }: { files: FileStat[]; email: string; name: string }) {
  const curve = useMemo(() => decayCurve(files, email), [files, email]);
  if (!curve || curve.points.length < 2) {
    return (
      <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-500">
        <p className="font-medium text-zinc-300">{name}</p>
        <p className="mt-1">{curve ? `Last commit ${curve.lastCommit}. Too recent to measure absorption yet.` : "No commits in the 3-year window."}</p>
      </div>
    );
  }
  const W = 260;
  const H = 90;
  const pad = { l: 28, r: 8, t: 10, b: 18 };
  const n = curve.points.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const path = curve.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.absorbed).toFixed(1)}`).join(" ");
  const last = curve.points[n - 1];
  const rotting = last.absorbed < 0.3;
  return (
    <div className="rounded-lg border border-zinc-800 p-3 text-xs">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-zinc-200">{name}</p>
        <p className={`text-[11px] ${rotting ? "text-red-300" : "text-emerald-300"}`}>{Math.round(last.absorbed * 100)}% absorbed</p>
      </div>
      <p className="text-[10px] text-zinc-500">{curve.files} files · last commit {curve.lastCommit}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#27272a" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="#71717a">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={rotting ? "#f87171" : "#34d399"} strokeWidth="1.5" />
        {curve.points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.absorbed)} r="1.8" fill={rotting ? "#f87171" : "#34d399"} />)}
        <text x={pad.l} y={H - 5} fontSize="8" fill="#71717a">0</text>
        <text x={W - pad.r} y={H - 5} fontSize="8" fill="#71717a" textAnchor="end">{n - 1} months after they left</text>
      </svg>
      <p className="text-[10px] text-zinc-600">Share of their files that someone else has since edited. Flat and low means the knowledge is rotting.</p>
    </div>
  );
}
