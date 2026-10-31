/** Client-safe helpers (no Node imports). */
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Go: "#00ADD8", Java: "#b07219", Rust: "#dea584", Ruby: "#701516",
  "C++": "#f34b7d", C: "#555555", "C#": "#178600", PHP: "#4F5D95", Kotlin: "#A97BFF", Swift: "#F05138", Dart: "#00B4AB", HTML: "#e34c26",
  CSS: "#563d7c", Shell: "#89e051", Vue: "#41b883", Svelte: "#ff3e00", Scala: "#c22d40", Elixir: "#6e4a7e", Haskell: "#5e5086", Lua: "#000080",
  "Jupyter Notebook": "#DA5B0B", Dockerfile: "#384d54", R: "#198CE7", MDX: "#fcb32c", Astro: "#ff5a03",
};

export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? "s" : ""} ago`;
  const y = Math.floor(mo / 12);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}
