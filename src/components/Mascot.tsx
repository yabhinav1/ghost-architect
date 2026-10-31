/**
 * Casper the Ghost-Architect: a friendly ghost in a hard hat with round glasses,
 * holding a rolled blueprint. Pure SVG so it scales from favicon to hero.
 */
export function Mascot({ size = 120, className = "", float = false }: { size?: number; className?: string; float?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`${float ? "mascot-float" : ""} ${className}`} role="img" aria-label="Ghost-Architect mascot">
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
      {/* eyes */}
      <circle cx="49" cy="61" r="3.5" fill="#e6edf3" />
      <circle cx="75" cy="61" r="3.5" fill="#e6edf3" />
      <circle cx="50" cy="60" r="1.4" fill="#0d1117" />
      <circle cx="76" cy="60" r="1.4" fill="#0d1117" />
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
