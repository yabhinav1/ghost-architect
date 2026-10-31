/** Next.js server start hook: warm the sample repos in the background so a new deploy is demo-ready. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.WARM_ON_BOOT === "0") return;
  const { warmOnBoot } = await import("./lib/warm");
  const delay = Number(process.env.WARM_DELAY_MS ?? 15000) || 15000;
  setTimeout(() => {
    warmOnBoot().catch((e) => console.error("[warm] boot warm failed", e));
  }, delay);
}
