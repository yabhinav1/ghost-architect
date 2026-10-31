"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { scoreColor } from "@/lib/score";
import type { Scored } from "@/lib/types";

export type Node = { name: string; file?: Scored; value?: number; children?: Node[] };

export function buildTree(files: Scored[]): Node {
  const root: Node = { name: "repo", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts[0] : "(root)";
    let group = root.children!.find((c) => c.name === dir);
    if (!group) {
      group = { name: dir, children: [] };
      root.children!.push(group);
    }
    group.children!.push({ name: parts.slice(1).join("/") || f.path, file: f, value: Math.max(f.lines, 8) });
  }
  return root;
}

/** Shared layout so the PNG export matches what is on screen. */
export function layoutFiles(files: Scored[], w: number, h: number) {
  const root = hierarchy(buildTree(files)).sum((d) => d.value ?? 0);
  treemap<Node>().size([w, h]).paddingOuter(3).paddingTop(18).paddingInner(2).tile(treemapSquarify)(root);
  return { groups: (root.children ?? []) as HierarchyRectangularNode<Node>[], leaves: (root.leaves() as HierarchyRectangularNode<Node>[]).filter((d) => d.data.file) };
}

export function Treemap({ files, selected, onSelect }: { files: Scored[]; selected: string | null; onSelect: (path: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [hover, setHover] = useState<{ file: Scored; x: number; y: number } | null>(null);

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

  // Layout depends only on paths and sizes, so toggling a departed author recolours in place instead of reshuffling.
  const layoutKey = files.map((f) => f.path + ":" + f.lines).join("|");
  const layout = useMemo(() => layoutFiles(files, size.w, size.h),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutKey, size]);

  const byPath = useMemo(() => new Map(files.map((f) => [f.path, f])), [files]);

  const tipLeft = hover ? Math.min(hover.x + 14, size.w - 260) : 0;
  const tipTop = hover ? (hover.y > size.h - 150 ? hover.y - 140 : hover.y + 14) : 0;

  if (files.length === 0) {
    return (
      <div ref={ref} className="blankslate rounded-md border border-border bg-canvas-inset" style={{ minHeight: 240 }}>
        <h3>No code files to map</h3>
        <p>This repository has no files Ghost-Architect recognises as source, or git could not read them.</p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-md border border-border bg-canvas-inset"
      style={{ height: size.h }}
      onMouseLeave={() => setHover(null)}
    >
      {layout.groups.map((g) => (
        <div key={g.data.name} className="absolute truncate px-1 font-mono text-[10px] text-fg-subtle" style={{ left: g.x0, top: g.y0 + 2, width: g.x1 - g.x0 }}>
          {g.data.name}
        </div>
      ))}
      {layout.leaves.map((d) => {
        const file = byPath.get(d.data.file!.path) ?? d.data.file!;
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        const isSel = file.path === selected;
        return (
          <button
            key={file.path}
            onClick={() => onSelect(file.path)}
            onMouseMove={(e) => {
              const rect = ref.current!.getBoundingClientRect();
              setHover({ file, x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            className={`absolute overflow-hidden rounded-[2px] text-left transition-[background-color,opacity] duration-500 ease-out hover:opacity-80 ${isSel ? "z-10 ring-2 ring-accent" : ""}`}
            style={{ left: d.x0, top: d.y0, width: w, height: h, background: scoreColor(file.score) }}
          >
            {w > 56 && h > 22 && <span className="block truncate px-1 pt-0.5 font-mono text-[11px] leading-tight text-white/90">{d.data.name}</span>}
            {w > 56 && h > 38 && <span className="block px-1 text-[10px] text-white/60">{file.score}</span>}
          </button>
        );
      })}

      {hover && (
        <div className="pointer-events-none absolute z-20 w-60 rounded-md border border-border bg-canvas-overlay p-2 text-xs shadow-xl" style={{ left: tipLeft, top: tipTop }}>
          <p className="break-all font-mono text-[11px] text-fg">{hover.file.path}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-semibold" style={{ color: scoreColor(Math.max(hover.file.score, 25)) }}>{hover.file.score}</span>
            <span className="text-fg-muted">orphaned criticality</span>
          </div>
          <dl className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-fg-muted">
            <div><dt>orphan</dt><dd className="text-fg">{Math.round(hover.file.orphanShare * 100)}%</dd></div>
            <div><dt>commits 12m</dt><dd className="text-fg">{hover.file.commits12m}</dd></div>
            <div><dt>importers</dt><dd className="text-fg">{hover.file.inbound}</dd></div>
          </dl>
          <p className="mt-1 text-[10px] text-fg-subtle">{hover.file.lines} lines · click for details</p>
        </div>
      )}
    </div>
  );
}
