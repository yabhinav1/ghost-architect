"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export type TourStep = { target: string; title: string; body: string; place?: "bottom" | "top" | "left" | "right" };

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Spotlight tour: dims the page, cuts a hole around the target element (by data-tour attribute),
 * and shows a card with Next / Back / Skip. The hole animates between steps.
 */
/** Mount it when the tour starts and unmount on close; it always begins at step one. */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    // Measurements happen in callbacks (next frame, after scroll, on resize), never synchronously in the effect.
    const measure = () => {
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
    };
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 340); // after the scroll settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  if (!step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const place = step.place ?? (rect && rect.top + rect.height + 180 > vh ? "top" : "bottom");
  const cardW = Math.min(340, vw - 32);
  let cardTop = 24;
  let cardLeft = 24;
  if (rect) {
    if (place === "bottom") { cardTop = rect.top + rect.height + 12; cardLeft = rect.left; }
    if (place === "top") { cardTop = rect.top - 12 - 170; cardLeft = rect.left; }
    if (place === "left") { cardTop = rect.top; cardLeft = rect.left - cardW - 12; }
    if (place === "right") { cardTop = rect.top; cardLeft = rect.left + rect.width + 12; }
    cardLeft = Math.max(16, Math.min(cardLeft, vw - cardW - 16));
    cardTop = Math.max(16, Math.min(cardTop, vh - 190));
  }
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Guided tour">
      {/* the hole: a box with a giant shadow dims everything else */}
      <div
        className="tour-hole absolute rounded-lg"
        style={rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : { top: vh / 2, left: vw / 2, width: 0, height: 0 }}
        onClick={onClose}
      />
      <div className="tour-card card absolute p-4 shadow-2xl" style={{ top: cardTop, left: cardLeft, width: cardW }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Step {i + 1} of {steps.length}</p>
        <p className="mt-1 text-[15px] font-semibold">{step.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{step.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onClose} className="btn btn-sm btn-invisible text-fg-muted">Skip</button>
          <span className="flex-1" />
          {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-sm">Back</button>}
          <button onClick={() => (last ? onClose() : setI(i + 1))} className="btn btn-sm btn-primary">{last ? "Done" : "Next"}</button>
        </div>
        <div className="mt-3 flex gap-1">
          {steps.map((_, k) => <span key={k} className={`h-1 flex-1 rounded ${k <= i ? "bg-accent" : "bg-border-muted"}`} />)}
        </div>
      </div>
    </div>
  );
}
