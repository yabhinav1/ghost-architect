"use client";

import { useState } from "react";
import { Mascot } from "@/components/Mascot";

/**
 * The delivery run. One 9-second loop:
 *   0-4%   ghost fades in at the departing engineer's desk, holding three files
 *   4-92%  runs right along the corridor
 *   28-38% hacker 1 bursts out of a floor hatch; ghost jumps over the grab
 *   56-70% hacker 2 drops from the ceiling on a rope; ghost slides under
 *   92-100% files drop into the team vault, counter ticks, ghost fades
 * All motion is CSS keyframes in globals.css (.scene-*), so it costs nothing on the main thread.
 */
export function ActionScene() {
  const [rescued, setRescued] = useState(0);

  return (
    <section className="mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-muted">Why we exist</p>
          <h2 className="text-xl font-semibold">Knowledge walks out with people. Casper carries it across before anyone can lose it.</h2>
        </div>
        <p className="text-[13px] text-fg-muted">
          Files rescued this visit: <span className="counter !text-[13px]">{rescued}</span>
        </p>
      </div>

      <div className="scene card overflow-hidden">
        <svg viewBox="0 0 1000 260" className="block w-full" role="img" aria-label="The ghost mascot carrying files from a departing engineer to the team vault while dodging two hackers">
          <defs>
            <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1117" />
              <stop offset="1" stopColor="#161b22" />
            </linearGradient>
            <linearGradient id="sc-vault" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#30363d" />
              <stop offset="1" stopColor="#21262d" />
            </linearGradient>
            <radialGradient id="sc-glow">
              <stop offset="0" stopColor="#1f6feb" stopOpacity="0.5" />
              <stop offset="1" stopColor="#1f6feb" stopOpacity="0" />
            </radialGradient>
            <clipPath id="sc-floor-clip"><rect x="0" y="0" width="1000" height="200" /></clipPath>
          </defs>

          {/* backdrop */}
          <rect width="1000" height="260" fill="url(#sc-sky)" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={i * 125} y1="0" x2={i * 125} y2="200" stroke="#21262d" strokeDasharray="2 6" />
          ))}
          <line x1="0" y1="200" x2="1000" y2="200" stroke="#30363d" strokeWidth="2" />

          {/* departing engineer's desk (left) */}
          <g className="scene-fade-desk">
            <rect x="40" y="150" width="120" height="8" rx="2" fill="#30363d" />
            <rect x="52" y="158" width="8" height="42" fill="#21262d" />
            <rect x="140" y="158" width="8" height="42" fill="#21262d" />
            <rect x="70" y="118" width="54" height="34" rx="3" fill="#0d1117" stroke="#58a6ff" strokeWidth="1.5" />
            <rect x="74" y="122" width="46" height="26" fill="#0d419d" opacity="0.6" />
            <text x="97" y="139" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#9ecbff">git blame</text>
            {/* the engineer, walking out */}
            <g className="scene-leaver">
              <circle cx="30" cy="128" r="9" fill="#8b949e" />
              <rect x="22" y="138" width="16" height="28" rx="4" fill="#6e7681" />
              <rect x="22" y="166" width="6" height="30" fill="#6e7681" />
              <rect x="32" y="166" width="6" height="30" fill="#6e7681" />
              <rect x="6" y="146" width="14" height="18" rx="2" fill="#30363d" stroke="#8b949e" />
            </g>
            <text x="100" y="222" textAnchor="middle" fontSize="11" fill="#8b949e">Departing engineer</text>
            <rect x="8" y="96" width="30" height="12" rx="2" fill="#da3633" />
            <text x="23" y="105" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">EXIT</text>
          </g>

          {/* the team vault (right) */}
          <g>
            <circle cx="915" cy="150" r="70" fill="url(#sc-glow)" />
            <rect x="860" y="100" width="110" height="100" rx="6" fill="url(#sc-vault)" stroke="#8b949e" strokeWidth="2" />
            <circle cx="915" cy="150" r="26" fill="none" stroke="#8b949e" strokeWidth="5" />
            <circle cx="915" cy="150" r="10" fill="#161b22" stroke="#3fb950" strokeWidth="3" className="scene-dial" />
            <rect x="958" y="110" width="6" height="80" rx="2" fill="#6e7681" />
            <text x="915" y="222" textAnchor="middle" fontSize="11" fill="#8b949e">Team knowledge</text>
            <g className="scene-plus">
              <rect x="880" y="60" width="70" height="22" rx="11" fill="#238636" />
              <text x="915" y="75" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">+3 files</text>
            </g>
          </g>

          {/* hacker 2: drops from the ceiling on a rope */}
          <g className="scene-hacker2">
            <line x1="640" y1="-200" x2="640" y2="70" stroke="#8b949e" strokeWidth="2" strokeDasharray="6 4" />
            <Hacker x={640} y={70} flip />
          </g>

          {/* hacker 1: bursts out of a floor hatch */}
          <g clipPath="url(#sc-floor-clip)">
            <g className="scene-hacker1">
              <Hacker x={380} y={130} />
            </g>
          </g>
          <rect x="350" y="198" width="60" height="5" rx="2" fill="#484f58" />

          {/* MISSED bubbles */}
          <g className="scene-miss1">
            <rect x="400" y="60" width="78" height="22" rx="11" fill="#da3633" />
            <text x="439" y="75" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">MISSED!</text>
          </g>
          <g className="scene-miss2">
            <rect x="660" y="160" width="78" height="22" rx="11" fill="#da3633" />
            <text x="699" y="175" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">NOPE.</text>
          </g>

          {/* the ghost: outer = run along X, middle = jump / slide, inner = bob */}
          <g className="scene-run" onAnimationIteration={() => setRescued((n) => n + 3)}>
            <g className="scene-dodge">
              <g className="scene-bob">
                <g transform="translate(-40 92)">
                  <Mascot size={110} />
                </g>
                {/* the files, held up over the head */}
                <g className="scene-files">
                  <File x={-8} y={64} label="utils" />
                  <File x={6} y={56} label="router" />
                  <File x={20} y={48} label="billing" />
                </g>
                {/* speed lines */}
                <g className="scene-speed" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" opacity="0.6">
                  <line x1="-50" y1="140" x2="-70" y2="140" />
                  <line x1="-46" y1="152" x2="-62" y2="152" />
                  <line x1="-50" y1="164" x2="-66" y2="164" />
                </g>
              </g>
            </g>
          </g>

          {/* floor, drawn last so hacker 1 hides beneath it */}
          <rect x="0" y="200" width="1000" height="60" fill="#0d1117" />
          <line x1="0" y1="200" x2="1000" y2="200" stroke="#30363d" strokeWidth="2" />
          <text x="500" y="244" textAnchor="middle" fontSize="11" fill="#6e7681">commit history · pull requests · blame · import graph</text>
        </svg>
      </div>
      <p className="mt-2 text-[12px] text-fg-subtle">Casper is a stand-in for the scoring and explainer pipeline. The hackers are what actually happens to undocumented code: it gets changed by someone who doesn&rsquo;t know why it was written.</p>
    </section>
  );
}

function File({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0h22l8 8v26H0z" fill="#e6edf3" stroke="#8b949e" strokeWidth="1" />
      <path d="M22 0v8h8" fill="#c9d1d9" stroke="#8b949e" strokeWidth="1" />
      <line x1="4" y1="14" x2="24" y2="14" stroke="#58a6ff" strokeWidth="1.5" />
      <line x1="4" y1="19" x2="20" y2="19" stroke="#8b949e" strokeWidth="1.5" />
      <line x1="4" y1="24" x2="22" y2="24" stroke="#8b949e" strokeWidth="1.5" />
      <text x="15" y="31" textAnchor="middle" fontSize="6" fontFamily="ui-monospace, monospace" fill="#0d1117">{label}</text>
    </g>
  );
}

/** A hooded figure with a laptop and glowing eyes. `flip` hangs it upside down from a rope. */
function Hacker({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) ${flip ? "scale(1 -1)" : ""}`}>
      {/* hood */}
      <path d="M-26 20c0-26 12-40 26-40s26 14 26 40v30h-52z" fill="#161b22" stroke="#30363d" strokeWidth="2" />
      <path d="M-16 10c0-14 7-22 16-22s16 8 16 22v12h-32z" fill="#010409" />
      {/* eyes */}
      <circle cx="-6" cy="6" r="3" fill="#f85149" className="scene-eye" />
      <circle cx="6" cy="6" r="3" fill="#f85149" className="scene-eye" />
      {/* grabbing arm */}
      <g className="scene-arm">
        <rect x="-30" y="14" width="34" height="8" rx="4" fill="#161b22" stroke="#30363d" strokeWidth="1.5" />
        <path d="M-38 12l-6-4 2 8-6 2 8 4z" fill="#8b949e" />
      </g>
      {/* laptop */}
      <rect x="-14" y="40" width="28" height="16" rx="2" fill="#30363d" stroke="#8b949e" strokeWidth="1.2" />
      <rect x="-12" y="42" width="24" height="12" fill="#0d1117" />
      <text x="0" y="51" textAnchor="middle" fontSize="7" fontFamily="ui-monospace, monospace" fill="#3fb950">rm -rf</text>
    </g>
  );
}
