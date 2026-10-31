import { Mascot } from "@/components/Mascot";
import type { Progress } from "@/lib/types";

export function MascotLoader({ title = "Getting your workspace ready", message = "Keep the knowledge. Carry the work forward.", compact = false, progress }: {
  title?: string;
  message?: string;
  compact?: boolean;
  progress?: Progress | null;
}) {
  const complete = progress?.total ? Math.min(progress.total, Math.max(0, progress.done ?? 0)) : null;
  return (
    <div role="status" aria-live="polite" className={compact ? "mascot-loader card mb-4 flex items-center gap-4 px-5 py-4" : "mascot-loader loader-grid flex min-h-[75vh] flex-col items-center justify-center px-6 py-12 text-center"}>
      <div className={`relative shrink-0 ${compact ? "h-20 w-20" : "mb-6 h-44 w-44"}`} aria-hidden="true">
        <span className="loader-orbit absolute inset-0 rounded-full border border-dashed border-accent/35" />
        <span className="absolute inset-4 rounded-full bg-accent-emphasis/10 blur-xl" />
        <div className="loader-ghost absolute inset-0 flex items-center justify-center"><Mascot size={compact ? 76 : 150} /></div>
        {!compact && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-canvas-overlay px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent">Casper is on it</span>}
      </div>
      <div className={compact ? "min-w-0 flex-1" : "max-w-sm"}>
        {!compact && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-fg-muted">Ghost-Architect</p>}
        <p className={compact ? "text-[14px] font-semibold" : "text-xl font-semibold tracking-tight"}>{title}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{progress?.step ?? message}</p>
        {complete !== null && progress?.total ? (
          <div className="mt-3 max-w-sm">
            <progress aria-label={progress.step} value={complete} max={progress.total} className="loader-progress h-1.5 w-full" />
            <p className="mt-1 text-[11px] text-fg-muted">{complete} / {progress.total} files</p>
          </div>
        ) : <div className={`loader-dots mt-4 flex gap-1.5 ${compact ? "" : "justify-center"}`} aria-hidden="true"><i /><i /><i /></div>}
      </div>
    </div>
  );
}
