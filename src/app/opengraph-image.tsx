import { ImageResponse } from "next/og";

export const alt = "Ghost-Architect: bus-factor radar for codebases that lost their authors";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #0d1117 0%, #161b22 60%, #0d1117 100%)", color: "#e6edf3", fontFamily: "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", left: 760, top: 40, width: 420, height: 420, borderRadius: 420, background: "rgba(31,111,235,0.25)", filter: "blur(60px)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#8b949e" }}>
            <span style={{ padding: "4px 14px", border: "1px solid rgba(88,166,255,0.4)", borderRadius: 999, color: "#58a6ff", background: "rgba(56,139,253,0.15)", fontSize: 20 }}>Bus-factor radar</span>
          </div>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.1, marginTop: 24, display: "flex", flexDirection: "column" }}>
            <span>Find the code nobody</span>
            <span>understands anymore,</span>
            <span style={{ color: "#58a6ff" }}>before it breaks.</span>
          </div>
          <div style={{ fontSize: 24, color: "#8b949e", marginTop: 24, lineHeight: 1.4 }}>Ghost-Architect scores orphaned files, plans handovers, and explains old code from commit evidence.</div>
          <div style={{ fontSize: 22, color: "#6e7681", marginTop: 36 }}>ghost-architect.onrender.com</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 480, height: "100%" }}>
          <svg viewBox="0 0 120 120" width="360" height="360">
            <ellipse cx="60" cy="110" rx="26" ry="5" fill="#000" opacity="0.25" />
            <path d="M28 58c0-20 14-34 32-34s32 14 32 34v40l-8-7-8 7-8-7-8 7-8-7-8 7-8-7-8 7z" fill="#e6edf3" stroke="#8b949e" strokeWidth="1.5" />
            <path d="M34 42c0-14 11-24 26-24s26 10 26 24z" fill="#ffd33d" stroke="#9a6700" strokeWidth="1.5" />
            <rect x="29" y="40" width="62" height="6" rx="3" fill="#ffd33d" stroke="#9a6700" strokeWidth="1.5" />
            <circle cx="47" cy="60" r="9" fill="#0d1117" stroke="#30363d" strokeWidth="2.5" />
            <circle cx="73" cy="60" r="9" fill="#0d1117" stroke="#30363d" strokeWidth="2.5" />
            <line x1="56" y1="60" x2="64" y2="60" stroke="#30363d" strokeWidth="2.5" />
            <circle cx="49" cy="61" r="3.5" fill="#e6edf3" />
            <circle cx="75" cy="61" r="3.5" fill="#e6edf3" />
            <circle cx="50" cy="60" r="1.4" fill="#0d1117" />
            <circle cx="76" cy="60" r="1.4" fill="#0d1117" />
            <path d="M53 74q7 6 14 0" fill="none" stroke="#6e7681" strokeWidth="2" strokeLinecap="round" />
            <g transform="rotate(-20 92 70)">
              <rect x="80" y="64" width="26" height="12" rx="3" fill="#1f6feb" stroke="#0d419d" strokeWidth="1.2" />
              <line x1="86" y1="70" x2="100" y2="70" stroke="#9ecbff" strokeWidth="1" />
            </g>
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
