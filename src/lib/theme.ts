/** Appearance preference, shared by the inline boot script and the client picker. */
export type ThemePref = "dark" | "light" | "system";
export const THEME_KEY = "ga-theme";
export const THEMES: { id: ThemePref; label: string; blurb: string }[] = [
  { id: "dark", label: "Dark", blurb: "The default. Primer dark, easy on the eyes in a demo room." },
  { id: "light", label: "Light", blurb: "Primer light, for bright rooms and projectors." },
  { id: "system", label: "Sync with system", blurb: "Follows your operating system's setting." },
];

/** Runs before first paint so the page never flashes the wrong theme. Keep it tiny and dependency-free. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"dark";var t=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var h=document.documentElement;h.setAttribute("data-theme",t);h.setAttribute("data-theme-pref",p);}catch(e){}})();`;

export function applyTheme(pref: ThemePref) {
  const resolved = pref === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : pref;
  const h = document.documentElement;
  h.setAttribute("data-theme", resolved);
  h.setAttribute("data-theme-pref", pref);
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* private mode */ }
  document.cookie = `${THEME_KEY}=${pref}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(THEME_KEY));
}

/** For useSyncExternalStore: re-render pickers when the preference changes in this or another tab. */
export function subscribeTheme(cb: () => void): () => void {
  window.addEventListener(THEME_KEY, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(THEME_KEY, cb); window.removeEventListener("storage", cb); };
}
export const serverThemePref = (): ThemePref => "dark";

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* ignore */ }
  return "dark";
}
