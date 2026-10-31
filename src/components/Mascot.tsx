"use client";

import { useEffect, useRef } from "react";

const EYES = [
  { cx: 49, cy: 61 },
  { cx: 75, cy: 61 },
];
const PUPIL_RANGE = 3.2; // viewBox units the pupil may travel inside the lens
const WHITE_RANGE = 1.4; // the eye white drifts a little too, for depth

/**
 * Casper the Ghost-Architect: a friendly ghost in a hard hat with round glasses,
 * holding a rolled blueprint. Pure SVG so it scales from favicon to hero.
 * With `track`, the eyes follow the cursor and blink now and then.
 */
export function Mascot({ size = 120, className = "", float = false, track = false }: { size?: number; className?: string; float?: boolean; track?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const whites = useRef<(SVGCircleElement | null)[]>([]);
  const pupils = useRef<(SVGCircleElement | null)[]>([]);
  const lids = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!track) return;
    const target = { x: 0, y: 0 }; // unit vector toward the cursor
    const current = { x: 0, y: 0 };
    let raf = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;

    const onMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const scale = r.width / 120;
      // aim from the midpoint between the eyes
      const ex = r.left + 62 * scale;
      const ey = r.top + 61 * scale;
      const dx = e.clientX - ex;
      const dy = e.clientY - ey;
      const dist = Math.hypot(dx, dy) || 1;
      // full deflection once the cursor is ~140px away, proportional before that
      const k = Math.min(1, dist / 140);
      target.x = (dx / dist) * k;
      target.y = (dy / dist) * k;
      clearTimeout(idle);
      idle = setTimeout(() => { target.x = 0; target.y = 0; }, 2500); // look forward again when the mouse rests
    };

    const tick = () => {
      current.x += (target.x - current.x) * 0.14;
      current.y += (target.y - current.y) * 0.14;
      whites.current.forEach((el) => el?.setAttribute("transform", `translate(${(current.x * WHITE_RANGE).toFixed(2)} ${(current.y * WHITE_RANGE).toFixed(2)})`));
      pupils.current.forEach((el) => el?.setAttribute("transform", `translate(${(current.x * PUPIL_RANGE).toFixed(2)} ${(current.y * PUPIL_RANGE).toFixed(2)})`));
      raf = requestAnimationFrame(tick);
    };

    // blink: squash the eye group for ~120ms at irregular intervals
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    const blink = () => {
      const g = lids.current;
      if (g) {
        g.style.transformOrigin = "62px 61px";
        g.style.transition = "transform 70ms ease-in";
        g.style.transform = "scaleY(0.08)";
        setTimeout(() => { g.style.transition = "transform 110ms ease-out"; g.style.transform = "scaleY(1)"; }, 90);
      }
      blinkTimer = setTimeout(blink, 2600 + Math.random() * 3200);
    };
    blinkTimer = setTimeout(blink, 1800);

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      clearTimeout(blinkTimer);
    };
  }, [track]);

  return (
    <svg ref={svgRef} viewBox="0 0 120 120" width={size} height={size} className={`${float ? "mascot-float" : ""} ${className}`} role="img" aria-label="Ghost-Architect mascot">
      <defs>
        <linearGradient id="gaBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d8dee6" />
        </linearGradient>
        <linearGradient id="gaHat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd33d" />
          <stop offset="1" stopColor="#e0a800" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="60" cy="110" rx="26" ry="5" fill="#000" opacity="0.25" />
      {/* body */}
      <path d="M28 58c0-20 14-34 32-34s32 14 32 34v40l-8-7-8 7-8-7-8 7-8-7-8 7-8-7-8 7z" fill="url(#gaBody)" stroke="#8b949e" strokeWidth="1.5" strokeLinejoin="round" />
      {/* blueprint under the arm */}
      <g transform="rotate(-20 92 70)">
        <rect x="80" y="64" width="26" height="12" rx="3" fill="#1f6feb" stroke="#0d419d" strokeWidth="1.2" />
        <rect x="80" y="64" width="26" height="12" rx="3" fill="none" stroke="#58a6ff" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.8" />
        <line x1="86" y1="70" x2="100" y2="70" stroke="#9ecbff" strokeWidth="1" />
      </g>
      {/* arm holding it */}
      <path d="M84 62c6 2 10 6 10 10" fill="none" stroke="#8b949e" strokeWidth="1.5" strokeLinecap="round" />
      {/* hard hat */}
      <path d="M34 42c0-14 11-24 26-24s26 10 26 24z" fill="url(#gaHat)" stroke="#9a6700" strokeWidth="1.5" />
      <rect x="29" y="40" width="62" height="6" rx="3" fill="#ffd33d" stroke="#9a6700" strokeWidth="1.5" />
      <rect x="56" y="22" width="8" height="18" rx="2" fill="#fff3b0" opacity="0.7" />
      {/* glasses */}
      <circle cx="47" cy="60" r="9" fill="#0d1117" stroke="#30363d" strokeWidth="2.5" />
      <circle cx="73" cy="60" r="9" fill="#0d1117" stroke="#30363d" strokeWidth="2.5" />
      <line x1="56" y1="60" x2="64" y2="60" stroke="#30363d" strokeWidth="2.5" />
      <line x1="38" y1="58" x2="32" y2="56" stroke="#30363d" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="82" y1="58" x2="88" y2="56" stroke="#30363d" strokeWidth="2.5" strokeLinecap="round" />
      {/* eyes: whites and pupils move with the cursor, the group squashes to blink */}
      <g ref={lids}>
        {EYES.map((e, i) => (
          <circle key={`w${i}`} ref={(el) => { whites.current[i] = el; }} cx={e.cx} cy={e.cy} r="3.5" fill="#e6edf3" />
        ))}
        {EYES.map((e, i) => (
          <circle key={`p${i}`} ref={(el) => { pupils.current[i] = el; }} cx={e.cx + 0.6} cy={e.cy - 0.6} r="1.5" fill="#0d1117" />
        ))}
      </g>
      {/* glasses shine */}
      <path d="M42 55q3-3 6-3" fill="none" stroke="#58a6ff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      <path d="M68 55q3-3 6-3" fill="none" stroke="#58a6ff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      {/* smile and cheeks */}
      <path d="M53 74q7 6 14 0" fill="none" stroke="#6e7681" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="72" r="3" fill="#f85149" opacity="0.35" />
      <circle cx="80" cy="72" r="3" fill="#f85149" opacity="0.35" />
    </svg>
  );
}

/** Tiny monochrome mark for nav bars and the favicon. */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <path d="M7 15c0-6 4-10 9-10s9 4 9 10v12l-3-2.5-3 2.5-3-2.5-3 2.5-3-2.5-3 2.5z" fill="currentColor" />
      <path d="M8 11c0-4 3.5-7 8-7s8 3 8 7z" fill="#ffd33d" />
      <rect x="6" y="10" width="20" height="2.2" rx="1" fill="#ffd33d" />
      <circle cx="12.5" cy="17" r="3" fill="#0d1117" />
      <circle cx="19.5" cy="17" r="3" fill="#0d1117" />
      <circle cx="13" cy="17" r="1.1" fill="#e6edf3" />
      <circle cx="20" cy="17" r="1.1" fill="#e6edf3" />
    </svg>
  );
}
