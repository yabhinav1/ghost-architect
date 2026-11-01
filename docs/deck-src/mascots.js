const sharp = require("sharp");
const fs = require("fs");
const BODY = `
<defs>
  <linearGradient id="gaBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8dee6"/></linearGradient>
  <linearGradient id="gaHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd33d"/><stop offset="1" stop-color="#e0a800"/></linearGradient>
</defs>
<ellipse cx="60" cy="110" rx="26" ry="5" fill="#000" opacity="0.25"/>
<path d="M28 58c0-20 14-34 32-34s32 14 32 34v40l-8-7-8 7-8-7-8 7-8-7-8 7-8-7-8 7z" fill="url(#gaBody)" stroke="#8b949e" stroke-width="1.5" stroke-linejoin="round"/>
__PROP__
<path d="M34 42c0-14 11-24 26-24s26 10 26 24z" fill="url(#gaHat)" stroke="#9a6700" stroke-width="1.5"/>
<rect x="29" y="40" width="62" height="6" rx="3" fill="#ffd33d" stroke="#9a6700" stroke-width="1.5"/>
<rect x="56" y="22" width="8" height="18" rx="2" fill="#fff3b0" opacity="0.7"/>
<circle cx="47" cy="60" r="9" fill="#0d1117" stroke="#30363d" stroke-width="2.5"/>
<circle cx="73" cy="60" r="9" fill="#0d1117" stroke="#30363d" stroke-width="2.5"/>
<line x1="56" y1="60" x2="64" y2="60" stroke="#30363d" stroke-width="2.5"/>
<line x1="38" y1="58" x2="32" y2="56" stroke="#30363d" stroke-width="2.5" stroke-linecap="round"/>
<line x1="82" y1="58" x2="88" y2="56" stroke="#30363d" stroke-width="2.5" stroke-linecap="round"/>
__EYES__
<path d="M42 55q3-3 6-3" fill="none" stroke="#58a6ff" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>
<path d="M68 55q3-3 6-3" fill="none" stroke="#58a6ff" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>
__MOUTH__
<circle cx="40" cy="72" r="3" fill="#f85149" opacity="0.35"/>
<circle cx="80" cy="72" r="3" fill="#f85149" opacity="0.35"/>`;
const eyes = (dx = 0.6, dy = -0.6) => `<circle cx="49" cy="61" r="3.5" fill="#e6edf3"/><circle cx="75" cy="61" r="3.5" fill="#e6edf3"/><circle cx="${49 + dx}" cy="${61 + dy}" r="1.5" fill="#0d1117"/><circle cx="${75 + dx}" cy="${61 + dy}" r="1.5" fill="#0d1117"/>`;
const happyEyes = `<path d="M45 62q4-5 8 0" fill="none" stroke="#e6edf3" stroke-width="2.2" stroke-linecap="round"/><path d="M71 62q4-5 8 0" fill="none" stroke="#e6edf3" stroke-width="2.2" stroke-linecap="round"/>`;
const smile = `<path d="M53 74q7 6 14 0" fill="none" stroke="#6e7681" stroke-width="2" stroke-linecap="round"/>`;
const bigSmile = `<path d="M50 73q10 10 20 0" fill="none" stroke="#6e7681" stroke-width="2" stroke-linecap="round"/>`;
const blueprint = `<g transform="rotate(-20 92 70)"><rect x="80" y="64" width="26" height="12" rx="3" fill="#1f6feb" stroke="#0d419d" stroke-width="1.2"/><rect x="80" y="64" width="26" height="12" rx="3" fill="none" stroke="#58a6ff" stroke-width="0.6" stroke-dasharray="2 2" opacity="0.8"/><line x1="86" y1="70" x2="100" y2="70" stroke="#9ecbff" stroke-width="1"/></g><path d="M84 62c6 2 10 6 10 10" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/>`;
const magnifier = `<path d="M84 64c6 2 10 6 12 10" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/><circle cx="100" cy="66" r="10" fill="#0d1117" fill-opacity="0.25" stroke="#8b949e" stroke-width="3"/><circle cx="100" cy="66" r="10" fill="none" stroke="#58a6ff" stroke-width="1"/><line x1="107" y1="73" x2="116" y2="84" stroke="#8b949e" stroke-width="4" stroke-linecap="round"/>`;
const clipboard = `<path d="M84 64c6 2 10 6 12 10" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/><g transform="rotate(12 100 74)"><rect x="90" y="60" width="22" height="28" rx="3" fill="#e6edf3" stroke="#8b949e" stroke-width="1.5"/><rect x="96" y="57" width="10" height="5" rx="2" fill="#30363d"/><path d="M94 70l3 3 6-6" fill="none" stroke="#3fb950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="94" y1="79" x2="108" y2="79" stroke="#8b949e" stroke-width="1.5"/><line x1="94" y1="83" x2="104" y2="83" stroke="#8b949e" stroke-width="1.5"/></g>`;
const shield = `<path d="M84 64c6 2 10 6 12 10" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/><path d="M100 58l13 5v10c0 9-6 14-13 17-7-3-13-8-13-17V63z" fill="#1f6feb" stroke="#0d419d" stroke-width="1.5"/><path d="M94 72l4 4 8-9" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const wave = `<path d="M84 60c6-4 10-10 10-18" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/><circle cx="94" cy="40" r="5" fill="#e6edf3" stroke="#8b949e" stroke-width="1.5"/>`;
const confetti = `<g>${[[14,20,"#f85149"],[30,10,"#3fb950"],[100,14,"#58a6ff"],[112,30,"#ffd33d"],[8,48,"#a371f7"],[110,52,"#f85149"],[22,96,"#58a6ff"],[104,98,"#3fb950"],[62,6,"#a371f7"],[88,8,"#f85149"]].map(([x,y,c],i)=>`<rect x="${x}" y="${y}" width="5" height="9" rx="1" fill="${c}" transform="rotate(${(i*47)%360} ${x} ${y})"/>`).join("")}</g>`;
const lightbulb = `<path d="M84 60c6-4 10-10 10-18" fill="none" stroke="#8b949e" stroke-width="1.5" stroke-linecap="round"/><circle cx="100" cy="30" r="9" fill="#ffd33d" stroke="#9a6700" stroke-width="1.5"/><rect x="96" y="38" width="8" height="6" rx="1.5" fill="#8b949e"/><g stroke="#ffd33d" stroke-width="2" stroke-linecap="round"><line x1="100" y1="14" x2="100" y2="18"/><line x1="112" y1="20" x2="109" y2="23"/><line x1="88" y1="20" x2="91" y2="23"/><line x1="114" y1="30" x2="110" y2="30"/></g>`;
const POSES = {
  default:   { prop: blueprint, eyes: eyes(), mouth: smile },
  search:    { prop: magnifier, eyes: eyes(2.2, 0.4), mouth: smile },
  clipboard: { prop: clipboard, eyes: eyes(1.6, 0.8), mouth: smile },
  shield:    { prop: shield, eyes: eyes(), mouth: smile },
  idea:      { prop: lightbulb, eyes: eyes(1.8, -2), mouth: bigSmile },
  wave:      { prop: wave, eyes: happyEyes, mouth: bigSmile },
  party:     { prop: confetti + wave, eyes: happyEyes, mouth: bigSmile },
};
(async () => {
  for (const [name, p] of Object.entries(POSES)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="720" height="720">${BODY.replace("__PROP__", p.prop).replace("__EYES__", p.eyes).replace("__MOUTH__", p.mouth)}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`mascot-${name}.png`);
  }
  console.log("mascots:", Object.keys(POSES).join(" "));
})();
