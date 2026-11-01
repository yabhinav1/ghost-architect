"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readThemePref, serverThemePref, subscribeTheme, THEMES } from "@/lib/theme";

/** Small preview of the app chrome in a given theme, drawn with fixed colours. */
function Preview({ theme }: { theme: "dark" | "light" }) {
  const c = theme === "dark"
    ? { bg: "#0d1117", inset: "#010409", card: "#161b22", border: "#30363d", text: "#e6edf3", muted: "#8b949e", accent: "#58a6ff", green: "#238636" }
    : { bg: "#ffffff", inset: "#f6f8fa", card: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#656d76", accent: "#0969da", green: "#1f883d" };
  return (
    <svg viewBox="0 0 200 110" width="100%" aria-hidden="true" style={{ display: "block", background: c.bg }}>
      <rect x="0" y="0" width="200" height="18" fill={c.inset} />
      <rect x="0" y="18" width="200" height="0.8" fill={c.border} />
      <circle cx="12" cy="9" r="5" fill="#ffd33d" />
      <rect x="22" y="6" width="34" height="6" rx="2" fill={c.text} />
      <rect x="150" y="5" width="40" height="8" rx="3" fill={c.green} />
      <rect x="12" y="28" width="110" height="70" rx="4" fill={c.card} stroke={c.border} />
      <rect x="20" y="36" width="50" height="5" rx="2" fill={c.text} />
      <rect x="20" y="46" width="90" height="3" rx="1.5" fill={c.muted} />
      <rect x="20" y="53" width="70" height="3" rx="1.5" fill={c.muted} />
      {[0, 1, 2].map((i) => <rect key={i} x={20 + i * 30} y="64" width="26" height="24" rx="3" fill={["#da3633", "#9e6a03", c.border][i]} opacity={0.85} />)}
      <rect x="130" y="28" width="58" height="70" rx="4" fill={c.card} stroke={c.border} />
      <rect x="137" y="36" width="30" height="5" rx="2" fill={c.text} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="137" y={47 + i * 11} width={44 - i * 6} height="3" rx="1.5" fill={i === 0 ? c.accent : c.muted} />)}
    </svg>
  );
}

/** The Appearance setting: three cards like GitHub's theme picker. Applies instantly, no reload. */
export function ThemePicker() {
  const pref = useSyncExternalStore(subscribeTheme, readThemePref, serverThemePref);
  const choose = applyTheme;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {THEMES.map((t) => (
        <button key={t.id} type="button" onClick={() => choose(t.id)} aria-pressed={pref === t.id} className="theme-card">
          {t.id === "system" ? (
            <div className="relative"><Preview theme="light" /><div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden"><div className="w-[200%] -translate-x-1/2"><Preview theme="dark" /></div></div></div>
          ) : <Preview theme={t.id} />}
          <div className="flex items-start gap-2 border-t border-border px-3 py-2">
            <span className={`mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${pref === t.id ? "border-accent bg-accent" : "border-fg-subtle"}`}>{pref === t.id && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}</span>
            <span><span className="block text-[13px] font-semibold">{t.label}{t.id === "dark" && <span className="label label-muted ml-2">default</span>}</span><span className="block text-[12px] text-fg-muted">{t.blurb}</span></span>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Compact segmented switch for menus. */
export function ThemeSwitch() {
  const pref = useSyncExternalStore(subscribeTheme, readThemePref, serverThemePref);
  return (
    <div className="segmented w-full" role="group" aria-label="Theme">
      {THEMES.map((t) => <button key={t.id} type="button" aria-pressed={pref === t.id} onClick={() => applyTheme(t.id)} className="flex-1 !px-2 !text-[12px]">{t.id === "system" ? "System" : t.label}</button>)}
    </div>
  );
}
