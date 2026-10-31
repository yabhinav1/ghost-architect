import type { ReactNode } from "react";

/** Deterministic hue from an email so the same person always gets the same colour. */
function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function Avatar({ name, email, size = 20, gone = false }: { name: string; email: string; size?: number; gone?: boolean }) {
  const initials = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const h = hue(email);
  return (
    <span
      title={email}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        background: gone ? "rgba(110,118,129,0.25)" : `hsl(${h} 45% 30%)`,
        color: gone ? "#8b949e" : `hsl(${h} 80% 85%)`,
        border: gone ? "1px dashed #6e7681" : "1px solid rgba(240,246,252,0.1)",
        textDecoration: gone ? "line-through" : undefined,
      }}
    >
      {initials}
    </span>
  );
}

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title !== undefined && (
        <header className="card-header">
          <span className="flex-1 truncate">{title}</span>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Octicon({ name, className = "h-4 w-4" }: { name: "repo" | "people" | "flame" | "file" | "history" | "share" | "download" | "report" | "ghost" | "check" | "search" | "clock"; className?: string }) {
  const paths: Record<string, string> = {
    repo: "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z",
    people: "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z",
    flame: "M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 6-6.5 6S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862 0 .862.5 0 .917.586 1.512 1.213 1.512.646 0 1.108-.586 1.108-1.512 0-2.126 1.028-3.17 1.886-4.012 1.198-1.177 2.146-2.107 1.539-2.449ZM8 14.5c1.933 0 3.5-1.567 3.5-3.5 0-.973-.397-1.77-1.08-2.47-.683-.7-1.08-1.03-1.08-2.03 0-.5-.5-.75-.75-.5C7.5 7 6.5 8.5 6.5 9.5c0 .5.5.75.5 1.5a1.5 1.5 0 0 1-1.5 1.5c-.5 0-1-.5-1-1a3.5 3.5 0 0 0 3.5 3Z",
    file: "M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z",
    history: "m.427 1.927 1.215 1.215a8.002 8.002 0 1 1-1.6 5.685.75.75 0 1 1 1.493-.154 6.5 6.5 0 1 0 1.18-4.458l1.358 1.358A.25.25 0 0 1 3.896 6H.25A.25.25 0 0 1 0 5.75V2.104a.25.25 0 0 1 .427-.177ZM7.75 4a.75.75 0 0 1 .75.75v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5A.75.75 0 0 1 7.75 4Z",
    share: "M3.5 3.75a.25.25 0 0 1 .25-.25h8.5a.25.25 0 0 1 .25.25v.5a.75.75 0 0 0 1.5 0v-.5A1.75 1.75 0 0 0 12.25 2h-8.5A1.75 1.75 0 0 0 2 3.75v8.5c0 .966.784 1.75 1.75 1.75h.5a.75.75 0 0 0 0-1.5h-.5a.25.25 0 0 1-.25-.25ZM8.22 7.72a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 1 1-1.06 1.06L9.5 10.06V15.25a.75.75 0 0 1-1.5 0v-5.19l-2.22 2.22a.75.75 0 1 1-1.06-1.06Z",
    download: "M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm4.5-4.19L4.72 7.28a.75.75 0 0 1 1.06-1.06l1.47 1.47V1.75a.75.75 0 0 1 1.5 0v5.94l1.47-1.47a.75.75 0 1 1 1.06 1.06l-2.53 2.53a.75.75 0 0 1-1.06 0Z",
    report: "M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
    ghost: "M8 0a6 6 0 0 0-6 6v8.5a.5.5 0 0 0 .8.4l1.7-1.3 1.7 1.3a.5.5 0 0 0 .6 0L8 13.6l1.2 1.3a.5.5 0 0 0 .6 0l1.7-1.3 1.7 1.3a.5.5 0 0 0 .8-.4V6a6 6 0 0 0-6-6ZM6 7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
    check: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z",
    search: "M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z",
    clock: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z",
  };
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function ShareBar({ parts, total, className = "" }: { parts: { key: string; value: number; color: string; title?: string }[]; total: number; className?: string }) {
  return (
    <span className={`flex h-2 w-full overflow-hidden rounded-full bg-border-muted ${className}`}>
      {parts.map((p) => (
        <span key={p.key} title={p.title} style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} className="h-full transition-[width] duration-500" />
      ))}
    </span>
  );
}
