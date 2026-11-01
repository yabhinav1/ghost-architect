/** A single headline number drawn as a ring. Server-safe; label always accompanies the colour. */
export function ReadinessRing({ score, label, size = 96, light = false }: { score: number; label: string; size?: number; light?: boolean }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const tone = label === "ready" ? "#1a7f37" : label === "nearly" ? "#0969da" : label === "in progress" ? "#9a6700" : "#cf222e";
  const toneDark = label === "ready" ? "#3fb950" : label === "nearly" ? "#58a6ff" : label === "in progress" ? "#d29922" : "#f85149";
  const stroke = light ? tone : toneDark;
  const track = light ? "#eaeef2" : "#30363d";
  const ink = light ? "#1f2328" : "#e6edf3";
  const muted = light ? "#59636e" : "#8b949e";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Readiness ${score} of 100, ${label}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dasharray 600ms ease" }} />
      <text x="50%" y="50%" dy="0.1em" textAnchor="middle" fontSize={size * 0.26} fontWeight={600} fill={ink} fontFamily="ui-sans-serif, system-ui">{score}</text>
      <text x="50%" y="50%" dy="1.6em" textAnchor="middle" fontSize={size * 0.11} fill={muted} fontFamily="ui-sans-serif, system-ui">{label}</text>
    </svg>
  );
}
