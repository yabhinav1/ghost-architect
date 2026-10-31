"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";

const LOOP_MS = 9000;

/** Piecewise-linear track: [time 0..1, value] pairs, interpolated. */
type Track = [number, number][];
function at(track: Track, t: number): number {
  if (t <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1] = track[i];
    if (t <= t1) {
      const [t0, v0] = track[i - 1];
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k;
    }
  }
  return track[track.length - 1][1];
}
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

// ---- the timeline (fractions of one 9s loop) ----
const RUN_X: Track = [[0, 90], [0.04, 90], [0.92, 830], [1, 830]];
const RUN_O: Track = [[0, 0], [0.03, 1], [0.92, 1], [0.97, 0], [1, 0]];
const JUMP_Y: Track = [[0, 0], [0.27, 0], [0.31, -78], [0.33, -88], [0.38, 0], [1, 0]];
const SQUASH: Track = [[0, 1], [0.37, 1], [0.385, 0.9], [0.40, 1], [0.57, 1], [0.60, 0.5], [0.68, 0.5], [0.71, 1], [1, 1]];
const FILES_O: Track = [[0, 1], [0.91, 1], [0.95, 0], [1, 0]];
const FILES_D: Track = [[0, 0], [0.91, 0], [0.95, 1], [1, 1]];
const PLUS: Track = [[0, 0], [0.93, 0], [0.95, 1], [0.99, 1], [1, 0]];
const PLUS_Y: Track = [[0, 10], [0.93, 10], [0.95, 0], [1, -18]];
const DIAL: Track = [[0, 0], [0.92, 0], [1, 360]];
const H1_Y: Track = [[0, 110], [0.25, 110], [0.29, 0], [0.32, -16], [0.35, 0], [0.41, 110], [1, 110]];
const H1_X: Track = [[0, 0], [0.29, 0], [0.32, -12], [0.35, 0], [1, 0]];
const H2_Y: Track = [[0, -180], [0.53, -180], [0.58, 0], [0.62, 16], [0.66, 0], [0.72, -180], [1, -180]];
const MISS1: Track = [[0, 0], [0.35, 0], [0.37, 1], [0.44, 1], [0.47, 0], [1, 0]];
const MISS2: Track = [[0, 0], [0.65, 0], [0.67, 1], [0.74, 1], [0.77, 0], [1, 0]];
const LEAVER_X: Track = [[0, 0], [0.2, -40], [0.85, -40], [1, 0]];
const LEAVER_O: Track = [[0, 1], [0.2, 0], [0.85, 0], [1, 1]];

export function ActionScene() {
  const [rescued, setRescued] = useState(0);
  const [playing, setPlaying] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let visible = true;
    let lastLoop = -1;
    let t0 = -1;
    // Elements are looked up once by data-k so the frame loop never touches React.
    const e: Record<string, SVGElement | undefined> = {};
    root.current?.querySelectorAll<SVGElement>("[data-k]").forEach((n) => { e[n.dataset.k!] = n; });

    const frame = (now: number) => {
      if (t0 < 0) t0 = now;
      const elapsed = now - t0;
      const loop = Math.floor(elapsed / LOOP_MS);
      const t = (elapsed % LOOP_MS) / LOOP_MS;
      if (loop !== lastLoop) {
        if (lastLoop >= 0) setRescued((n) => n + 3);
        lastLoop = loop;
      }
      const ms = elapsed;

      // ghost: run, dodge, bob
      e.run?.setAttribute("transform", `translate(${at(RUN_X, t).toFixed(1)} 0)`);
      e.run?.setAttribute("opacity", at(RUN_O, t).toFixed(2));
      const jump = at(JUMP_Y, t);
      const sq = at(SQUASH, t);
      // scale about the feet (y = 200) so a squash keeps the ghost on the floor
      e.dodge?.setAttribute("transform", `translate(0 ${jump.toFixed(1)}) translate(0 200) scale(1 ${sq.toFixed(3)}) translate(0 -200)`);
      const bob = jump === 0 ? Math.sin(ms / 75) * 3 : 0;
      e.bob?.setAttribute("transform", `translate(0 ${bob.toFixed(1)})`);
      const fd = easeOut(at(FILES_D, t));
      e.files?.setAttribute("transform", `translate(${(fd * 60).toFixed(1)} ${(fd * 40).toFixed(1)}) rotate(${(fd * 25).toFixed(1)} 10 60)`);
      e.files?.setAttribute("opacity", at(FILES_O, t).toFixed(2));
      e.speed?.setAttribute("opacity", (0.6 - ((ms % 300) / 300) * 0.6).toFixed(2));
      e.speed?.setAttribute("transform", `translate(${(-((ms % 300) / 300) * 14).toFixed(1)} 0)`);

      // vault
      const plus = at(PLUS, t);
      e.plus?.setAttribute("opacity", plus.toFixed(2));
      e.plus?.setAttribute("transform", `translate(0 ${at(PLUS_Y, t).toFixed(1)})`);
      e.dial?.setAttribute("transform", `rotate(${at(DIAL, t).toFixed(1)} 915 150)`);

      // hackers
      e.h1?.setAttribute("transform", `translate(${at(H1_X, t).toFixed(1)} ${at(H1_Y, t).toFixed(1)})`);
      e.h2?.setAttribute("transform", `translate(0 ${at(H2_Y, t).toFixed(1)})`);
      const arm = -8 + (Math.sin(ms / 80) + 1) * 15;
      e.arm1?.setAttribute("transform", `rotate(${arm.toFixed(1)} 4 18)`);
      e.arm2?.setAttribute("transform", `rotate(${(-arm).toFixed(1)} 4 18)`);
      const eye = (0.5 + (Math.sin(ms / 180) + 1) * 0.25).toFixed(2);
      e.eyes1?.setAttribute("opacity", eye);
      e.eyes2?.setAttribute("opacity", eye);

      // bubbles, leaver
      const m1 = at(MISS1, t);
      e.miss1?.setAttribute("opacity", m1.toFixed(2));
      e.miss1?.setAttribute("transform", `translate(439 71) scale(${(0.6 + 0.4 * m1).toFixed(2)}) translate(-439 -71)`);
      const m2 = at(MISS2, t);
      e.miss2?.setAttribute("opacity", m2.toFixed(2));
      e.miss2?.setAttribute("transform", `translate(699 171) scale(${(0.6 + 0.4 * m2).toFixed(2)}) translate(-699 -171)`);
      e.leaver?.setAttribute("transform", `translate(${at(LEAVER_X, t).toFixed(1)} 0)`);
      e.leaver?.setAttribute("opacity", at(LEAVER_O, t).toFixed(2));

      if (visible) raf = requestAnimationFrame(frame);
    };

    // only animate while the scene is on screen
    const io = new IntersectionObserver(([entry]) => {
      const nowVisible = entry.isIntersecting;
      if (nowVisible && !visible) raf = requestAnimationFrame(frame);
      visible = nowVisible;
      setPlaying(nowVisible);
    }, { threshold: 0.1 });
    if (root.current) io.observe(root.current);
    raf = requestAnimationFrame(frame);
    return () => {
      visible = false;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <section className="mt-20" ref={root}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-muted">Why we exist</p>
          <h2 className="text-xl font-semibold">Knowledge walks out with people. Casper carries it across before anyone can lose it.</h2>
        </div>
        <p className="text-[13px] text-fg-muted">
          Files rescued this visit: <span className="counter !text-[13px]">{rescued}</span>
          {!playing && <span className="ml-2 text-fg-subtle">(paused off-screen)</span>}
        </p>
      </div>

      <div className="card overflow-hidden">
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

          <rect width="1000" height="260" fill="url(#sc-sky)" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={i * 125} y1="0" x2={i * 125} y2="200" stroke="#21262d" strokeDasharray="2 6" />
          ))}

          {/* departing engineer's desk */}
          <g>
            <rect x="40" y="150" width="120" height="8" rx="2" fill="#30363d" />
            <rect x="52" y="158" width="8" height="42" fill="#21262d" />
            <rect x="140" y="158" width="8" height="42" fill="#21262d" />
            <rect x="70" y="118" width="54" height="34" rx="3" fill="#0d1117" stroke="#58a6ff" strokeWidth="1.5" />
            <rect x="74" y="122" width="46" height="26" fill="#0d419d" opacity="0.6" />
            <text x="97" y="139" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#9ecbff">git blame</text>
            <g data-k="leaver">
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

          {/* team vault */}
          <g>
            <circle cx="915" cy="150" r="70" fill="url(#sc-glow)" />
            <rect x="860" y="100" width="110" height="100" rx="6" fill="url(#sc-vault)" stroke="#8b949e" strokeWidth="2" />
            <circle cx="915" cy="150" r="26" fill="none" stroke="#8b949e" strokeWidth="5" />
            <g data-k="dial">
              <circle cx="915" cy="150" r="10" fill="#161b22" stroke="#3fb950" strokeWidth="3" />
              <line x1="915" y1="140" x2="915" y2="150" stroke="#3fb950" strokeWidth="3" strokeLinecap="round" />
            </g>
            <rect x="958" y="110" width="6" height="80" rx="2" fill="#6e7681" />
            <text x="915" y="222" textAnchor="middle" fontSize="11" fill="#8b949e">Team knowledge</text>
            <g data-k="plus" opacity="0">
              <rect x="880" y="60" width="70" height="22" rx="11" fill="#238636" />
              <text x="915" y="75" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">+3 files</text>
            </g>
          </g>

          {/* hacker 2 on a rope from the ceiling */}
          <g data-k="h2" transform="translate(0 -180)">
            <line x1="640" y1="-200" x2="640" y2="70" stroke="#8b949e" strokeWidth="2" strokeDasharray="6 4" />
            <Hacker x={640} y={70} flip armKey="arm2" eyesKey="eyes2" />
          </g>

          {/* hacker 1 from a floor hatch */}
          <g clipPath="url(#sc-floor-clip)">
            <g data-k="h1" transform="translate(0 110)">
              <Hacker x={380} y={130} armKey="arm1" eyesKey="eyes1" />
            </g>
          </g>
          <rect x="350" y="198" width="60" height="5" rx="2" fill="#484f58" />

          <g data-k="miss1" opacity="0">
            <rect x="400" y="60" width="78" height="22" rx="11" fill="#da3633" />
            <text x="439" y="75" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">MISSED!</text>
          </g>
          <g data-k="miss2" opacity="0">
            <rect x="660" y="160" width="78" height="22" rx="11" fill="#da3633" />
            <text x="699" y="175" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">NOPE.</text>
          </g>

          {/* the ghost */}
          <g data-k="run" transform="translate(90 0)" opacity="0">
            <g data-k="dodge">
              <g data-k="bob">
                <g transform="translate(-40 92)">
                  <Mascot size={110} />
                </g>
                <g data-k="files">
                  <File x={-8} y={64} label="utils" />
                  <File x={6} y={56} label="router" />
                  <File x={20} y={48} label="billing" />
                </g>
                <g data-k="speed" stroke="#8b949e" strokeWidth="2" strokeLinecap="round" opacity="0.6">
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

function Hacker({ x, y, flip = false, armKey, eyesKey }: { x: number; y: number; flip?: boolean; armKey: string; eyesKey: string }) {
  return (
    <g transform={`translate(${x} ${y}) ${flip ? "scale(1 -1)" : ""}`}>
      <path d="M-26 20c0-26 12-40 26-40s26 14 26 40v30h-52z" fill="#161b22" stroke="#30363d" strokeWidth="2" />
      <path d="M-16 10c0-14 7-22 16-22s16 8 16 22v12h-32z" fill="#010409" />
      <g data-k={eyesKey}>
        <circle cx="-6" cy="6" r="3" fill="#f85149" />
        <circle cx="6" cy="6" r="3" fill="#f85149" />
      </g>
      <g data-k={armKey}>
        <rect x="-30" y="14" width="34" height="8" rx="4" fill="#161b22" stroke="#30363d" strokeWidth="1.5" />
        <path d="M-38 12l-6-4 2 8-6 2 8 4z" fill="#8b949e" />
      </g>
      <rect x="-14" y="40" width="28" height="16" rx="2" fill="#30363d" stroke="#8b949e" strokeWidth="1.2" />
      <rect x="-12" y="42" width="24" height="12" fill="#0d1117" />
      <text x="0" y="51" textAnchor="middle" fontSize="7" fontFamily="ui-monospace, monospace" fill="#3fb950">rm -rf</text>
    </g>
  );
}
