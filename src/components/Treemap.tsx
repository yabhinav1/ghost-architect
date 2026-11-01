"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { scoreColor } from "@/lib/score";
import type { Scored } from "@/lib/types";

export type Node = { name: string; path?: string; value?: number; score?: number; children?: Node[] };

function buildTree(files: Scored[]): Node {
  const root: Node = { name: "repo", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts[0] : "(root)";
    let group = root.children!.find((c) => c.name === dir);
    if (!group) {
      group = { name: dir, children: [] };
      root.children!.push(group);
    }
    group.children!.push({ name: parts.slice(1).join("/") || f.path, path: f.path, value: Math.max(f.lines, 8), score: f.score });
  }
  return root;
}

export function layoutFiles(files: Scored[], w: number, h: number) {
  const root = hierarchy(buildTree(files)).sum((d) => d.value ?? 0);
  treemap<Node>().size([w, h]).paddingOuter(3).paddingTop(18).paddingInner(2).tile(treemapSquarify)(root);
  return {
    groups: (root.children ?? []) as HierarchyRectangularNode<Node>[],
    leaves: root.leaves() as HierarchyRectangularNode<Node>[],
  };
}

export function Treemap({ files, selected, onSelect }: { files: Scored[]; selected: string | null; onSelect: (path: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setSize({ w, h: Math.max(420, Math.round(w * 0.62)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const leaves = useMemo(() => layoutFiles(files, size.w, size.h), [files, size]);

  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950" style={{ height: size.h }}>
      {leaves.groups.map((g) => (
        <div
          key={g.data.name}
          className="absolute truncate px-1 text-[10px] uppercase tracking-wide text-zinc-500"
          style={{ left: g.x0, top: g.y0 + 2, width: g.x1 - g.x0 }}
        >
          {g.data.name}
        </div>
      ))}
      {leaves.leaves.map((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const isSel = d.data.path === selected;
        return (
          <button
            key={d.data.path}
            onClick={() => onSelect(d.data.path!)}
            title={`${d.data.path}\nscore ${d.data.score}`}
            className={`absolute overflow-hidden text-left transition-opacity hover:opacity-80 ${isSel ? "ring-2 ring-white z-10" : ""}`}
            style={{ left: d.x0, top: d.y0, width: w, height: h, background: scoreColor(d.data.score ?? 0) }}
          >
            {w > 56 && h > 22 && (
              <span className="block truncate px-1 pt-0.5 text-[11px] leading-tight text-white/90">{d.data.name}</span>
            )}
            {w > 56 && h > 38 && <span className="block px-1 text-[10px] text-white/60">{d.data.score}</span>}
          </button>
        );
      })}
    </div>
  );
}