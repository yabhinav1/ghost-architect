/** Print a deployment's health report. `npm run doctor` (local) or `npm run doctor -- https://your-site`. */
export {};
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const res = await fetch(`${base}/api/health`);
const j = (await res.json()) as Record<string, { status?: string; hint?: string; [k: string]: unknown }>;
console.log(`${base}  →  ${j.ok ? "healthy" : "needs attention"} (HTTP ${res.status})`);
for (const k of ["oauth", "githubToken", "llm"]) {
  const v = j[k] ?? {};
  const extra = Object.entries(v).filter(([key]) => !["status", "hint"].includes(key)).map(([key, val]) => `${key}=${val}`).join(" ");
  console.log(`  ${k.padEnd(12)} ${String(v.status ?? "?").padEnd(10)} ${extra}${v.hint ? `\n               ↳ ${v.hint}` : ""}`);
}
console.log(`  ${"durableStore".padEnd(12)} ${j.durableStore}`);
process.exit(j.ok ? 0 : 1);
