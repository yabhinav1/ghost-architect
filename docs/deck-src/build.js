/* Ghost-Architect overview deck: GitHub dark theme, mascot on every slide. */
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Fi = require("react-icons/fi");
const fs = require("fs");
const { applyTheme } = require("/Users/abhinav/.claude/skills/synced/cd3b6558-e46e-44e3-b5ec-0798480b0e1a_f0b21c1c-3316-4a25-8a85-5fce463c7868/pptx/scripts/apply_theme.js");

const THEME = {
  name: "GitHub Dark",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "E6EDF3", lt1: "0D1117", dk2: "8B949E", lt2: "161B22",
    accent1: "58A6FF", accent2: "3FB950", accent3: "F85149", accent4: "D29922", accent5: "A371F7", accent6: "30363D",
    hlink: "58A6FF", folHlink: "A371F7",
  },
};
const HEX = THEME.colors;
const BORDER = HEX.accent6;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.author = "Ghost-Architect team";
pres.title = "Ghost-Architect";
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.lt1 },
  objects: [
    { text: { text: "Ghost-Architect  ·  ghost-architect.onrender.com", options: { x: 0.5, y: 5.22, w: 6, h: 0.3, fontSize: 10, color: C.text2, margin: 0, isTextBox: true } } },
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.35, w: 9, h: 0.7, fontSize: 30, bold: true, color: C.text1, margin: 0, valign: "middle", align: "left" } } },
  ],
  slideNumber: { x: 9.2, y: 5.22, w: 0.4, h: 0.3, fontSize: 10, color: HEX.dk2 },
});
pres.defineSlideMaster({ title: "COVER", background: { color: HEX.lt1 }, objects: [] });

// ---------- helpers ----------
async function icon(Name, color = HEX.accent1, px = 256) {
  const svg = renderToStaticMarkup(React.createElement(Fi[Name], { color: `#${color}`, size: px, strokeWidth: 2 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const img = (name) => fs.readFileSync(`mascot-${name}.png`);
const mascot = (slide, pose, x, y, w, name = "mascot") => slide.addImage({ data: "image/png;base64," + img(pose).toString("base64"), x, y, w, h: w, objectName: name });

/** Speech bubble next to the mascot: the mascot "explains" each slide in one line. */
function bubble(slide, text, x, y, w, h = 0.75, tail = "right") {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: C.background2 }, line: { color: BORDER, width: 1 }, rectRadius: 0.12, objectName: "bubble-box" });
  const tx = tail === "right" ? x + w - 0.02 : x - 0.18;
  slide.addShape(pres.ShapeType.rtTriangle, { x: tx, y: y + h / 2 - 0.1, w: 0.2, h: 0.2, fill: { color: C.background2 }, line: { color: BORDER, width: 1 }, rotate: tail === "right" ? 45 : 225, objectName: "bubble-tail" });
  slide.addText(text, { x: x + 0.12, y, w: w - 0.24, h, fontSize: 12.5, italic: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "bubble-text" });
}

function card(slide, x, y, w, h, name = "card") {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: C.background2 }, line: { color: BORDER, width: 1 }, rectRadius: 0.1, objectName: name });
}

function iconCircle(slide, data, x, y, d = 0.5, bg = HEX.accent1) {
  slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg, transparency: 82 }, line: { color: bg, width: 0.75 }, objectName: "icon-bg" });
  slide.addImage({ data, x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, objectName: "icon" });
}

function bullets(slide, items, x, y, w, h, size = 10.5, name = "bullets") {
  slide.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: i < items.length - 1 } })), { x, y, w, h, fontSize: size, color: C.text2, margin: 0, isTextBox: true, paraSpaceAfter: 4, valign: "top", objectName: name });
}
function panel(slide, head, items, x, y, w, h, size = 10.5, name = "panel", headColor = C.text1) {
  card(slide, x, y, w, h, `${name}-card`);
  slide.addText(head, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.32, fontSize: 12.5, bold: true, color: headColor, margin: 0, isTextBox: true, valign: "middle", objectName: `${name}-h` });
  bullets(slide, items, x + 0.15, y + 0.48, w - 0.3, h - 0.58, size, `${name}-b`);
}
function box(slide, text, x, y, w, h, color = HEX.accent1, name = "box") {
  slide.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: color, transparency: 85 }, line: { color: color, width: 1 }, rectRadius: 0.08, objectName: `${name}-bg` });
  slide.addText(text, { x: x + 0.05, y, w: w - 0.1, h, fontSize: 10.5, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `${name}-t` });
}
function arrow(slide, x1, y1, x2, y2, name = "arrow") {
  slide.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.01, h: Math.abs(y2 - y1) || 0.01, flipH: x2 < x1, flipV: y2 < y1, line: { color: HEX.dk2, width: 1.25, endArrowType: "triangle" }, objectName: name });
}
function smallMascot(slide, pose, say) {
  mascot(slide, pose, 8.45, 3.95, 1.1, "mascot");
  if (say) bubble(slide, say, 6.1, 4.2, 2.3, 0.6, "right");
}
/** Tiny Casper peeking in at the top-right corner of dense slides. */
function cornerMascot(slide, pose) {
  mascot(slide, pose, 8.95, 0.28, 0.72, "mascot");
}

function title(slide, text) {
  slide.addText(text, { placeholder: "title" });
}

(async () => {
  const I = {
    search: await icon("FiSearch"), book: await icon("FiBookOpen", HEX.accent5), pr: await icon("FiGitPullRequest", HEX.accent4), check: await icon("FiCheckCircle", HEX.accent2),
    users: await icon("FiUsers", HEX.accent1), shield: await icon("FiShield", HEX.accent2), lock: await icon("FiLock", HEX.accent4), eye: await icon("FiEyeOff", HEX.accent3),
    github: await icon("FiGithub", HEX.dk1), cpu: await icon("FiCpu", HEX.accent5), mail: await icon("FiMail", HEX.accent2), server: await icon("FiServer", HEX.accent1),
    zap: await icon("FiZap", HEX.accent4), clock: await icon("FiClock", HEX.accent3), file: await icon("FiFileText", HEX.accent1), user: await icon("FiUser", HEX.accent1), briefcase: await icon("FiBriefcase", HEX.accent5), star: await icon("FiStar", HEX.accent4),
    arrow: await icon("FiArrowRight", HEX.dk2), gitbranch: await icon("FiGitBranch", HEX.accent1), calendar: await icon("FiCalendar", HEX.accent3), award: await icon("FiAward", HEX.accent2),
  };

  // ---------- 1. cover ----------
  pres.addSection({ title: "Overview" });
  let s = pres.addSlide({ masterName: "COVER", sectionTitle: "Overview" });
  s.addShape(pres.ShapeType.ellipse, { x: 5.6, y: -1.2, w: 6.5, h: 6.5, fill: { color: HEX.accent1, transparency: 90 }, line: { color: HEX.accent1, transparency: 100 }, objectName: "bg-glow" });
  s.addText("Ghost-Architect", { x: 0.6, y: 1.55, w: 5.6, h: 0.9, fontSize: 44, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "cover-title" });
  s.addText("Find the code nobody understands anymore, before it breaks.", { x: 0.6, y: 2.45, w: 5.4, h: 0.9, fontSize: 20, color: C.text2, margin: 0, isTextBox: true, objectName: "cover-tagline" });
  s.addText([
    { text: "Bus-factor radar  ·  evidence-backed code briefs  ·  handovers that actually land", options: { breakLine: true } },
    { text: "hackCBS 2026", options: { color: C.accent1, bold: true } },
  ], { x: 0.6, y: 3.55, w: 5.6, h: 0.8, fontSize: 13, color: C.text2, margin: 0, isTextBox: true, paraSpaceAfter: 6, objectName: "cover-meta" });
  mascot(s, "default", 6.35, 0.75, 3.3);
  bubble(s, "Hi, I'm Casper. I look after code whose owners have left.", 2.55, 4.45, 3.7, 0.6, "right");
  s.addNotes("Open with the one-liner: when an engineer leaves, the code stays and the understanding leaves. We find that code, explain it, and run the handover.");

  // ---------- 2. problem ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Overview" });
  title(s, "The problem: knowledge leaves with people");
  s.addText("Layoffs do it to twenty engineers at once. Notice periods give you thirty days and almost nobody uses them well. Six months later, someone has to change a file nobody understands.", { x: 0.5, y: 1.15, w: 5.6, h: 1.0, fontSize: 15, color: C.text2, margin: 0, isTextBox: true, objectName: "problem-text" });
  const stats = [
    { n: "184", l: "people have committed to Express", c: HEX.accent1 },
    { n: "3", l: "of them leave in our demo", c: HEX.accent4 },
    { n: "78%", l: "of all lines are suddenly orphaned", c: HEX.accent3 },
  ];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 1.95;
    card(s, x, 2.4, 1.8, 1.75, `stat-card-${i}`);
    s.addText(st.n, { x: x + 0.15, y: 2.5, w: 1.5, h: 0.85, fontSize: 40, bold: true, color: st.c, margin: 0, isTextBox: true, objectName: `stat-n-${i}` });
    s.addText(st.l, { x: x + 0.15, y: 3.35, w: 1.55, h: 0.7, fontSize: 12, color: C.text2, margin: 0, isTextBox: true, objectName: `stat-l-${i}` });
  });
  s.addText("Real numbers from analysing expressjs/express with its top three authors marked as departed.", { x: 0.5, y: 4.3, w: 5.6, h: 0.5, fontSize: 11, italic: true, color: C.text2, margin: 0, isTextBox: true, objectName: "problem-source" });
  mascot(s, "search", 6.9, 1.35, 2.6);
  bubble(s, "GitHub knows who wrote every line. It has no idea who is still here.", 6.35, 4.15, 3.2, 0.8, "left");
  s.addNotes("The stats are real: Express has 184 contributors; mark the top three as gone and 78% of lines were last touched by someone who left.");

  // ---------- 3. what it does ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Overview" });
  title(s, "What it does, in four moves");
  const moves = [
    { ic: I.search, h: "Find", t: "Scores every file by how much of it belongs to people who left, how often it changes, and what depends on it. Red files will hurt first." },
    { ic: I.book, h: "Explain", t: "Reads the commits and pull requests behind a file and writes a brief: purpose, risks, what to check before changing it. Every claim cites its evidence." },
    { ic: I.pr, h: "Hand over", t: "A manager assigns the leaver's files to a receiver. Notes, links, ticks per file, plus the open PRs, branches and TODOs that die with them." },
    { ic: I.check, h: "Verify", t: "A knowledge check written from the leaver's own notes. The receiver must pass it, then gets a printable day-one packet." },
  ];
  moves.forEach((m, i) => {
    const x = 0.5 + (i % 2) * 3.15, y = 1.2 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 3.0, 1.65, `move-card-${i}`);
    iconCircle(s, m.ic, x + 0.15, y + 0.15, 0.5);
    s.addText(m.h, { x: x + 0.75, y: y + 0.13, w: 2.1, h: 0.5, fontSize: 17, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle", objectName: `move-h-${i}` });
    s.addText(m.t, { x: x + 0.15, y: y + 0.68, w: 2.72, h: 0.92, fontSize: 11, color: C.text2, margin: 0, isTextBox: true, valign: "top", objectName: `move-t-${i}` });
  });
  mascot(s, "idea", 7.0, 1.3, 2.5);
  bubble(s, "Risk map first, then the why, then a human actually absorbs it.", 6.5, 4.05, 3.1, 0.8, "left");
  s.addNotes("Four moves: find, explain, hand over, verify. The combination is the product.");

  // ---------- 4. how it works ----------
  pres.addSection({ title: "System" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "How it works");
  const flow = [
    { ic: I.github, h: "GitHub repo", t: "Paste a URL. Private repos use the viewer's own access, every request." },
    { ic: I.gitbranch, h: "Real git history", t: "Clone, blame every line, four years of commits, import graph." },
    { ic: I.zap, h: "Criticality score", t: "Orphan share × activity × reach. Deterministic, 0 to 100." },
    { ic: I.cpu, h: "Briefs with evidence", t: "A free model writes the why from commits and PRs. Cited, labelled." },
  ];
  const FW = 1.58, FG = 0.14;
  flow.forEach((f, i) => {
    const x = 0.5 + i * (FW + FG);
    card(s, x, 1.2, FW, 2.05, `flow-card-${i}`);
    iconCircle(s, f.ic, x + 0.14, 1.33, 0.46);
    s.addText(f.h, { x: x + 0.14, y: 1.9, w: FW - 0.28, h: 0.4, fontSize: 12.5, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: `flow-h-${i}` });
    s.addText(f.t, { x: x + 0.14, y: 2.3, w: FW - 0.28, h: 0.9, fontSize: 10, color: C.text2, margin: 0, isTextBox: true, objectName: `flow-t-${i}` });
  });
  const outs = [
    { ic: I.file, h: "Heatmap and CODEOWNERS", t: "Treemap of risk, generated owners file, shareable report." },
    { ic: I.users, h: "Organisation layer", t: "Members matched to commits, notices and letters, audit log." },
    { ic: I.mail, h: "Email and GitHub actions", t: "Notices and handoffs by email; collaborator and ownership changes on accept." },
  ];
  const OW = 2.14, OG = 0.17;
  outs.forEach((o, i) => {
    const x = 0.5 + i * (OW + OG);
    card(s, x, 3.5, OW, 1.45, `out-card-${i}`);
    iconCircle(s, o.ic, x + 0.15, 3.62, 0.42);
    s.addText(o.h, { x: x + 0.68, y: 3.6, w: OW - 0.8, h: 0.45, fontSize: 11.5, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle", objectName: `out-h-${i}` });
    s.addText(o.t, { x: x + 0.15, y: 4.12, w: OW - 0.3, h: 0.75, fontSize: 10, color: C.text2, margin: 0, isTextBox: true, objectName: `out-t-${i}` });
  });
  bubble(s, "Switch the model off and the radar still works.", 7.5, 1.2, 2.0, 1.05, "right");
  mascot(s, "clipboard", 7.5, 2.6, 2.0);
  s.addNotes("The risk score needs no AI. The model only writes the briefs and quiz questions, from evidence we hand it.");


  // ---------- architecture ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "Architecture at a glance");
  box(s, "Browser\nNext.js 16 app, React 19\nTailwind + Primer tokens", 0.5, 1.3, 2.0, 1.0, HEX.accent1, "a-browser");
  box(s, "Next.js server\nApp Router route handlers\nSuspense + partial prefetch", 3.3, 1.3, 2.3, 1.0, HEX.accent5, "a-server");
  box(s, "GitHub\nOAuth · REST API\ngit over HTTPS", 6.6, 0.95, 2.0, 0.75, HEX.dk2, "a-github");
  box(s, "Groq (free tier)\nopenai/gpt-oss-120b + 20b", 6.6, 1.85, 2.0, 0.6, HEX.accent4, "a-llm");
  box(s, "Brevo\nemail over HTTPS", 6.6, 2.6, 2.0, 0.55, HEX.accent2, "a-mail");
  box(s, "Clone cache\n.cache/repos, size watchdog", 0.5, 3.1, 1.75, 0.8, HEX.accent6, "a-clones");
  box(s, "Analysis + brief cache\nJSON per repo and file", 2.4, 3.1, 1.95, 0.8, HEX.accent6, "a-analysis");
  box(s, "Document store\norgs · members · notices\nhandovers · transfers · audit", 4.5, 3.1, 2.0, 0.8, HEX.accent6, "a-db");
  box(s, "Upstash Redis\noptional mirror, TLS", 4.5, 4.15, 2.0, 0.55, HEX.accent3, "a-redis");
  arrow(s, 2.5, 1.8, 3.3, 1.8, "ar1"); arrow(s, 5.6, 1.6, 6.6, 1.3, "ar2"); arrow(s, 5.6, 1.85, 6.6, 2.1, "ar3"); arrow(s, 5.6, 2.1, 6.6, 2.85, "ar4");
  arrow(s, 4.4, 2.3, 1.4, 3.1, "ar5"); arrow(s, 4.45, 2.3, 3.4, 3.1, "ar6"); arrow(s, 4.5, 2.3, 5.5, 3.1, "ar7"); arrow(s, 5.5, 3.9, 5.5, 4.15, "ar8");
  s.addText([
    { text: "Sessions: ", options: { bold: true, color: C.text1 } }, { text: "AES-256-GCM sealed httpOnly cookie carries the GitHub token; the server never stores it.", options: { breakLine: true } },
    { text: "Per request: ", options: { bold: true, color: C.text1 } }, { text: "every repo endpoint re-checks the viewer's GitHub access before touching a clone.", options: { breakLine: true } },
    { text: "Hosting: ", options: { bold: true, color: C.text1 } }, { text: "Render (Docker), self-warm on boot, keep-alive ping, /api/health self-check." },
  ], { x: 0.5, y: 4.1, w: 3.9, h: 1.0, fontSize: 9.5, color: C.text2, margin: 0, isTextBox: true, paraSpaceAfter: 3, objectName: "arch-notes" });
  mascot(s, "clipboard", 8.45, 3.95, 1.1, "mascot");
  bubble(s, "One server, three caches, three outside services.", 6.75, 3.3, 2.7, 0.55, "right");
  s.addNotes("Walk left to right: browser, server, external services; the bottom row is what we persist.");

  // ---------- analysis pipeline ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "Analysis pipeline, in detail");
  panel(s, "1 · Clone and list", ["Shallow-safe clone to a per-repo cache key; watchdog aborts past 300 MB", "git ls-files, keep source extensions only; skip vendored, minified, lockfiles, generated dirs", "rev-parse HEAD guard: empty repos get a friendly error"], 0.5, 1.2, 2.9, 1.75, 9.5, "p1");
  panel(s, "2 · Blame and history", ["git blame --line-porcelain streamed per file, bounded concurrency", "git log --since 4 years with numstat: per-file commits in 12 and 24 months, per-author commits, last touched, daily timeline", "Up to 400 recent commits kept for the activity feed"], 3.55, 1.2, 2.9, 1.75, 9.5, "p2");
  panel(s, "3 · Imports and reach", ["Multi-language import resolver: JS/TS, Python, Go, Java, Rust, Ruby, PHP and more", "Resolves relative and aliased paths to real files", "Inbound count per file = how many others depend on it"], 6.6, 1.2, 2.9, 1.75, 9.5, "p3");
  panel(s, "4 · Score", ["orphanShare = 0.6 × blame share + 0.4 × commit share by departed authors", "× log(1 + commits in 12 months) × (1 + inbound)", "Normalised 0–100, colour ramp grey → amber → red"], 0.5, 3.1, 2.9, 1.5, 9.5, "p4");
  panel(s, "5 · Outputs", ["Treemap heatmap (PNG export), riskiest files, author list with who-left toggles", "Generated CODEOWNERS, printable report, share links, time-machine slider", "Decay chart: how fast orphaned lines get absorbed over months"], 3.55, 3.1, 2.9, 1.5, 9.5, "p5");
  panel(s, "6 · Cache and warm", ["Analysis cached per repo; briefs per file; mirrored to Upstash when set", "Warm script pre-analyses demo repos on boot and on a schedule", "Vector search (TF-IDF) over a user's repos, public/private classes"], 6.6, 3.1, 2.9, 1.5, 9.5, "p6");
  cornerMascot(s, "search");
  s.addNotes("The whole pipeline is plain git plus arithmetic. No model involved until the briefs.");
  // ---------- 5. risk in numbers (native chart) ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "The risk score, on a real repository");
  const files = [["test/support/utils.js", 100], ["lib/utils.js", 66], ["lib/response.js", 34], ["lib/request.js", 29], ["lib/application.js", 23], ["test/app.render.js", 12]];
  card(s, 0.5, 1.15, 5.9, 3.75, "chart-card");
  s.addText("Top orphaned files in expressjs/express once its top 3 authors leave", { x: 0.7, y: 1.25, w: 5.5, h: 0.35, fontSize: 12, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "chart-title" });
  const barX = 2.55, barMax = 3.3, rowH = 0.5, y0 = 1.75;
  files.forEach(([name, v], i) => {
    const y = y0 + i * rowH;
    const col = v >= 60 ? HEX.accent3 : v >= 25 ? HEX.accent4 : BORDER;
    s.addText(name, { x: 0.7, y, w: 1.8, h: 0.36, fontSize: 10, color: C.text1, margin: 0, isTextBox: true, valign: "middle", align: "right", fontFace: "Courier New", objectName: `bar-label-${i}` });
    s.addShape(pres.ShapeType.roundRect, { x: barX, y: y + 0.04, w: Math.max(0.12, (v / 100) * barMax), h: 0.28, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.04, objectName: `bar-${i}` });
    s.addText(String(v), { x: barX + (v / 100) * barMax + 0.08, y, w: 0.5, h: 0.36, fontSize: 10.5, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle", objectName: `bar-value-${i}` });
  });
  [["0", 0], ["50", 0.5], ["100", 1]].forEach(([t, f], i) => {
    s.addShape(pres.ShapeType.line, { x: barX + f * barMax, y: y0 - 0.05, w: 0, h: rowH * files.length, line: { color: BORDER, width: 0.5, dashType: "dash" }, objectName: `grid-${i}` });
    s.addText(t, { x: barX + f * barMax - 0.25, y: y0 + rowH * files.length, w: 0.5, h: 0.25, fontSize: 9, color: C.text2, align: "center", margin: 0, isTextBox: true, objectName: `grid-label-${i}` });
  });
  s.addText([{ text: "■ ", options: { color: C.accent3 } }, { text: "high risk   " }, { text: "■ ", options: { color: C.accent4 } }, { text: "watch   " }, { text: "■ ", options: { color: C.accent6 } }, { text: "fine" }], { x: 0.7, y: 4.5, w: 4, h: 0.3, fontSize: 10, color: C.text2, margin: 0, isTextBox: true, objectName: "chart-legend" });
  card(s, 6.65, 1.15, 2.85, 1.9, "formula-card");
  s.addText("score =", { x: 6.8, y: 1.22, w: 2.6, h: 0.35, fontSize: 12, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "formula-h" });
  s.addText([
    { text: "orphan share", options: { bold: true, color: C.text1 } }, { text: "  (0.6 blame + 0.4 recent commits)", options: { breakLine: true } },
    { text: "× activity", options: { bold: true, color: C.text1 } }, { text: "  log(1 + commits, 12 months)", options: { breakLine: true } },
    { text: "× reach", options: { bold: true, color: C.text1 } }, { text: "  1 + files that import it", options: { breakLine: true } },
    { text: "normalised to 0 – 100", options: { italic: true } },
  ], { x: 6.8, y: 1.55, w: 2.6, h: 1.45, fontSize: 10.5, color: C.text2, margin: 0, isTextBox: true, paraSpaceAfter: 3, objectName: "formula-t" });
  mascot(s, "search", 7.4, 3.0, 1.95);
  bubble(s, "Same repo, same answer, for everyone. No vibes.", 6.55, 4.6, 2.95, 0.5, "right");
  s.addNotes("The chart is real output: the two red files are where a new maintainer gets hurt first. The formula is deterministic and explainable.");


  // ---------- explain engine ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "Explain engine: briefs with evidence");
  box(s, "File", 0.5, 1.35, 1.1, 0.55, HEX.accent1, "e1");
  box(s, "Evidence\ncommits touching it,\nlinked pull requests", 1.95, 1.2, 1.9, 0.85, HEX.accent6, "e2");
  box(s, "Prompt\ntrimmed to fit free-tier limits", 4.2, 1.2, 1.9, 0.85, HEX.accent5, "e3");
  box(s, "JSON brief\nzod-validated,\ntolerant parser", 6.45, 1.2, 1.7, 0.85, HEX.accent2, "e4");
  arrow(s, 1.6, 1.62, 1.95, 1.62, "ea1"); arrow(s, 3.85, 1.62, 4.2, 1.62, "ea2"); arrow(s, 6.1, 1.62, 6.45, 1.62, "ea3");
  panel(s, "What a brief contains", ["Purpose: why the file exists, in two sentences", "Claims, each with evidence links and a status: documented (cites a commit or PR) or inferred", "Undocumented: what nobody wrote down", "Risks and a safe-change checklist", "Cached per file; regenerated on demand"], 0.5, 2.3, 2.9, 2.2, 9.5, "x1");
  panel(s, "Model lanes and limits", ["OpenAI-compatible client; Groq by default, optional second provider", "Per-model lane scheduler spreads batch work across gpt-oss-120b and 20b", "429 handling reads the suggested wait and retries; prompts trimmed to 8k TPM", "Rate limits per IP, account and server-wide ceiling"], 3.55, 2.3, 2.9, 2.2, 9.5, "x2");
  panel(s, "Casper, the assistant", ["Streams answers about the open file or page, with deep links", "Same evidence rules: says 'not documented' instead of inventing", "Knows the current page: repository, dashboard, organisation, inbox", "Also writes the knowledge check from the leaver's notes"], 6.6, 2.3, 2.9, 2.2, 9.5, "x3");
  s.addText("Honest by design: documented vs inferred is shown in the UI; switch the model off and the radar, handovers and work-in-flight still work.", { x: 0.5, y: 4.65, w: 7.6, h: 0.4, fontSize: 10.5, italic: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "explain-note" });
  cornerMascot(s, "idea");
  s.addNotes("The model only ever sees evidence we collected; it is told to label guesses.");

  // ---------- organisation system ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "System" });
  title(s, "Organisation layer: data model");
  const ents = [
    ["Org", "name, slug, supportAccess (NDA switch), createdBy", HEX.accent1],
    ["Member", "login, name, git email, role owner/manager/member, status active/leaving/left, lastDay", HEX.accent1],
    ["Invite", "single-use token, role bounded by inviter, optional login pin", HEX.accent6],
    ["OrgRepo", "linked repository, analysed on demand, feeds activity and handovers", HEX.accent6],
    ["Notice", "template type, subject, body, status sent/read/acknowledged, printable letter", HEX.accent4],
    ["Handover", "leaver → receiver, repo, files[path, notes, links, done], dueDate, quiz + attempts", HEX.accent2],
    ["WorkTransfer", "recipient email, notes, branch/PR, grant (access, ownership), sealed sender token", HEX.accent5],
    ["Audit", "who did what to whom, with metadata, per org and platform", HEX.accent3],
  ];
  ents.forEach(([h, t, c], i) => {
    const x = 0.5 + (i % 2) * 3.65, y = 1.2 + Math.floor(i / 2) * 0.92;
    card(s, x, y, 3.5, 0.8, `ent-card-${i}`);
    s.addShape(pres.ShapeType.roundRect, { x: x + 0.12, y: y + 0.12, w: 1.15, h: 0.3, fill: { color: c, transparency: 80 }, line: { color: c, width: 0.75 }, rectRadius: 0.06, objectName: `ent-tag-bg-${i}` });
    s.addText(h, { x: x + 0.12, y: y + 0.12, w: 1.15, h: 0.3, fontSize: 10.5, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, fontFace: "Courier New", objectName: `ent-tag-${i}` });
    s.addText(t, { x: x + 1.38, y: y + 0.08, w: 2.02, h: 0.66, fontSize: 9, color: C.text2, margin: 0, isTextBox: true, valign: "middle", objectName: `ent-t-${i}` });
  });
  panel(s, "How it is used", ["Activity log matches every commit to a member by git email; unmatched emails are listed for mapping", "Notices from templates (notice period, layoff, handover) with {name} {org} {lastDay} placeholders", "Managers see progress per handover; members see only their own", "Everything is a JSON document under .cache/db, mirrored to Upstash"], 7.75, 1.2, 1.75, 3.6, 8.5, "org-use");
  cornerMascot(s, "clipboard");
  s.addNotes("Eight record types. The audit log is the thing an auditor asks for first.");
  // ---------- 6. handover flow ----------
  pres.addSection({ title: "Workflow" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "The handover, step by step");
  const steps = [
    { ic: I.briefcase, h: "Assign", t: "Manager picks leaver, receiver and repo. Files come from the data." },
    { ic: I.file, h: "Notes", t: "Leaver writes why, gotchas and links per file. Both tick them off." },
    { ic: I.gitbranch, h: "Work in flight", t: "Open PRs, assigned issues, unmerged branches, their TODOs." },
    { ic: I.award, h: "Knowledge check", t: "Five questions from the notes. Receiver needs 80%, one attempt per quiz." },
    { ic: I.book, h: "Day-one packet", t: "Printable brief for the new owner, also as Markdown." },
    { ic: I.calendar, h: "Countdown", t: "Calendar to the last day with every due date and what is still open." },
  ];
  steps.forEach((st, i) => {
    const x = 0.5 + (i % 3) * 2.15, y = 1.2 + Math.floor(i / 3) * 1.9;
    card(s, x, y, 2.0, 1.7, `step-card-${i}`);
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.15, y: y + 0.15, w: 0.4, h: 0.4, fill: { color: HEX.accent2, transparency: 80 }, line: { color: HEX.accent2, width: 0.75 }, objectName: `step-num-bg-${i}` });
    s.addText(String(i + 1), { x: x + 0.15, y: y + 0.15, w: 0.4, h: 0.4, fontSize: 13, bold: true, color: C.accent2, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `step-num-${i}` });
    s.addText(st.h, { x: x + 0.65, y: y + 0.12, w: 1.25, h: 0.46, fontSize: 13.5, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle", objectName: `step-h-${i}` });
    s.addText(st.t, { x: x + 0.15, y: y + 0.68, w: 1.72, h: 0.95, fontSize: 10.5, color: C.text2, margin: 0, isTextBox: true, objectName: `step-t-${i}` });
  });
  s.addText("Readiness score 0 – 100 across all of it: files walked through, notes written, open items, quiz passed.", { x: 0.5, y: 4.95, w: 6.4, h: 0.3, fontSize: 10.5, italic: true, color: C.text2, margin: 0, isTextBox: true, objectName: "readiness-note" });
  mascot(s, "clipboard", 7.3, 1.3, 2.3);
  bubble(s, "Not 'document everything'. Just the ten files that matter.", 6.95, 3.75, 2.6, 0.95, "left");
  s.addNotes("Walk the six steps. Mention the one-attempt quiz: the leaver regenerates it for a retry, so it cannot be brute-forced.");


  // ---------- handover intelligence ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Handover intelligence: what is computed");
  panel(s, "Work in flight", ["Open pull requests the leaver authored (GitHub search API)", "Open issues assigned to them", "Branches only they pushed, with unmerged commit counts (for-each-ref + rev-list)", "TODO / FIXME / HACK they wrote, found with git grep and attributed by blame", "Cached ten minutes per person and repo"], 0.5, 1.2, 2.9, 2.3, 9.5, "hi1");
  panel(s, "Readiness score 0–100", ["55 % share of files walked through", "25 % share of files with real notes", "+20 minus penalties for open PRs, issues, branches and TODOs", "Knowledge check: −15 until passed, +5 when passed", "Labels: not ready · in progress · nearly · ready"], 3.55, 1.2, 2.9, 2.3, 9.5, "hi2");
  panel(s, "Knowledge check", ["Five multiple-choice questions written only from the leaver's notes and cached briefs", "Receiver needs 80 %; one scored attempt per generated quiz", "Answer keys never reach the browser; wrong answers get the explanation, not the key", "Attempts recorded and shown to managers; feeds readiness"], 6.6, 1.2, 2.9, 2.3, 9.5, "hi3");
  panel(s, "Day-one packet", ["Who is leaving and when, readiness ring, first-week checklist", "Per file: why it exists, the leaver's notes, risks, before-you-change-it list, evidence commits, links", "Work in flight in four counted panels", "Printable page and Markdown download"], 0.5, 3.65, 4.4, 1.4, 9.5, "hi4");
  panel(s, "Countdown", ["Monday-to-Sunday calendar from this week to the last day", "Due dates amber, completions green, last day red, overdue flagged", "Shown to the leaver on their inbox and to managers per leaver"], 5.05, 3.65, 4.45, 1.4, 9.5, "hi5");
  cornerMascot(s, "clipboard");
  s.addNotes("Everything on this slide is derived from git and GitHub, except the quiz questions.");

  // ---------- permissions matrix ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Who can do what");
  const H = { bold: true, color: HEX.dk1, fill: { color: HEX.lt2 }, fontSize: 10.5, border: { type: "solid", color: BORDER, pt: 0.75 }, align: "center" };
  const Lc = { color: HEX.dk1, fontSize: 10, border: { type: "solid", color: BORDER, pt: 0.75 }, valign: "middle" };
  const Y = { text: "yes", options: { color: HEX.accent2, bold: true, fontSize: 10, align: "center", border: { type: "solid", color: BORDER, pt: 0.75 }, valign: "middle" } };
  const N = { text: "no", options: { color: HEX.dk2, fontSize: 10, align: "center", border: { type: "solid", color: BORDER, pt: 0.75 }, valign: "middle" } };
  const P = (t) => ({ text: t, options: { color: HEX.accent4, fontSize: 9.5, align: "center", border: { type: "solid", color: BORDER, pt: 0.75 }, valign: "middle" } });
  const mrows = [
    [{ text: "Action", options: H }, { text: "Anyone", options: H }, { text: "User", options: H }, { text: "Member", options: H }, { text: "Manager / Owner", options: H }, { text: "Admin", options: H }],
    [{ text: "Analyse a public repository", options: Lc }, Y, Y, Y, Y, Y],
    [{ text: "Analyse a private repository", options: Lc }, N, P("own access"), P("own access"), P("own access"), P("own access")],
    [{ text: "See an organisation's members, repos, activity", options: Lc }, N, N, Y, Y, P("support access")],
    [{ text: "Invite members, set leaving status and last day", options: Lc }, N, N, N, Y, N],
    [{ text: "Send notices and letters, assign handovers", options: Lc }, N, N, N, Y, N],
    [{ text: "Edit an owner's role or status", options: Lc }, N, N, N, P("owner only"), N],
    [{ text: "Write notes, tick files, take the knowledge check", options: Lc }, N, N, P("own handover"), Y, N],
    [{ text: "Generate the knowledge check", options: Lc }, N, N, P("leaver"), Y, N],
    [{ text: "Send a work handoff with GitHub access changes", options: Lc }, N, P("repo admin"), P("repo admin"), P("repo admin"), P("repo admin")],
    [{ text: "Platform health, metrics, platform audit", options: Lc }, N, N, N, N, Y],
  ];
  s.addTable(mrows, { x: 0.5, y: 1.15, w: 9.0, colW: [3.1, 1.0, 1.2, 1.2, 1.4, 1.1], rowH: 0.33, fontFace: "Calibri", margin: 0.04, objectName: "perm-table" });
  s.addText("Every row is enforced on the server per request, never only in the UI. Admin support access is switched on by the organisation owner and every admin action inside is audited.", { x: 0.5, y: 4.85, w: 9.0, h: 0.35, fontSize: 9.5, italic: true, color: C.text2, margin: 0, isTextBox: true, objectName: "perm-note" });
  cornerMascot(s, "shield");
  s.addNotes("Point at the 'own access' cells: private repos are always gated by the viewer's own GitHub token.");
  // ---------- 7. roles and security ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Three roles, one rule: see only what GitHub lets you see");
  const roles = [
    { ic: I.user, h: "User", t: "Their own repos, inbox and handovers. Analyses, writes notes, takes the quiz." },
    { ic: I.users, h: "Organisation", t: "Owners and managers: members, linked repos, activity log, notices, handovers, audit." },
    { ic: I.star, h: "Admin", t: "Platform health and metrics. Inside an organisation only when its owner grants support access." },
  ];
  roles.forEach((r, i) => {
    const x = 0.5 + i * 2.15;
    card(s, x, 1.2, 2.0, 1.6, `role-card-${i}`);
    iconCircle(s, r.ic, x + 0.15, 1.33, 0.45);
    s.addText(r.h, { x: x + 0.7, y: 1.3, w: 1.2, h: 0.5, fontSize: 14, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: "middle", objectName: `role-h-${i}` });
    s.addText(r.t, { x: x + 0.15, y: 1.85, w: 1.72, h: 0.9, fontSize: 10.5, color: C.text2, margin: 0, isTextBox: true, objectName: `role-t-${i}` });
  });
  const sec = [
    { ic: I.lock, t: "No passwords anywhere. GitHub sign-in only; tokens stay in an AES-256-GCM sealed cookie, never in our store." },
    { ic: I.eye, t: "Every repo request re-checks the viewer's own GitHub access. Files are read through git with path validation." },
    { ic: I.shield, t: "Rate limits per IP, account and server. Audit log on every organisation action." },
    { ic: I.check, t: "Independent adversarial review on 1 Nov: 3 high, 5 medium findings, all fixed and verified the same day." },
  ];
  sec.forEach((it, i) => {
    const y = 3.05 + i * 0.5;
    iconCircle(s, it.ic, 0.5, y, 0.38);
    s.addText(it.t, { x: 1.0, y, w: 5.9, h: 0.38, fontSize: 10.5, color: C.text2, margin: 0, isTextBox: true, valign: "middle", objectName: `sec-t-${i}` });
  });
  mascot(s, "shield", 7.3, 1.1, 2.3);
  bubble(s, "If our store leaked: names and notes. No passwords, no tokens.", 6.95, 3.55, 2.6, 0.95, "left");
  s.addNotes("Say the review out loud: it found real issues and we fixed them the same day. That beats 'we think it is secure'.");


  // ---------- security design ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Security design");
  panel(s, "Identity and sessions", ["GitHub OAuth web flow with random state cookie; GitHub App manifest one-click setup as fallback", "Session = AES-256-GCM sealed httpOnly, Secure, SameSite=Lax cookie; token never stored server-side", "No passwords exist; dev login only when NODE_ENV≠production and DEV_LOGIN=1, with no GitHub token"], 0.5, 1.2, 4.4, 1.75, 9.5, "sd1");
  panel(s, "Repository access", ["authorizeRepo on every endpoint: GitHub visibility with the viewer's token, cached; anonymous git ls-remote probe as fallback", "Repo URLs canonicalised to https://github.com/owner/repo, nothing else", "Files read via git show HEAD:<path> after path validation: no traversal, no symlink escape", "Clone credentials passed per command, never written to .git/config; isolated from host keychains"], 5.05, 1.2, 4.45, 1.75, 9.5, "sd2");
  panel(s, "Abuse and tenancy", ["Rate limits per IP, per account and global on analysis, model calls, quiz, pending work, mail", "Random 72-bit ids; every id route re-checks ownership or membership", "Only owners edit owners; admins enter an org only with audited support access", "Prototype-safe maps, zod-validated payloads, length caps everywhere"], 0.5, 3.1, 4.4, 1.9, 9.5, "sd3");
  panel(s, "Delegated GitHub actions and operator controls", ["Handoff grants seal the sender's token with AUTH_SECRET; used once on accept, dropped on decline/cancel, expire after 7 days; refused without AUTH_SECRET in production", "Emails escape all user text and never auto-link it; outbox fallback on disk", "/setup cannot replace configured credentials without SETUP_TOKEN; /api/health reports status, never values", "Independent adversarial review on 1 Nov: 3 high + 5 medium found, all fixed and verified"], 5.05, 3.1, 4.45, 1.9, 9.5, "sd4");
  cornerMascot(s, "shield");
  s.addNotes("This is the slide for the 'what if your database leaks' question: names and notes, no passwords, no tokens.");

  // ---------- email and github actions ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Email delivery and GitHub actions");
  panel(s, "Email", ["Brevo over HTTPS (Render's free plan blocks SMTP ports); SMTP with a Gmail app password elsewhere", "GitHub-notification style template: logo, card, facts table, quoted notes, callouts, green call to action, plain-text twin", "Sent for notices and letters, handover assignments, work handoffs, admin test", "No provider configured: messages land in .cache/outbox so demos still show them", "Health check logs in to the provider; admin page has a one-click test send"], 0.5, 1.2, 4.4, 2.6, 9.5, "em1");
  panel(s, "Work handoffs that change GitHub", ["Sender chooses at send time: nothing, collaborator with write, collaborator with admin, and optionally transfer ownership", "Requires repo admin at send time; organisation-owned repos cannot be transferred with a personal token", "On accept: PUT /repos/{owner}/{repo}/collaborators/{user}, then POST /repos/{owner}/{repo}/transfer", "GitHub emails the new owner; the move completes when they accept within a day", "Failures leave the sender a retry button with their live session"], 5.05, 1.2, 4.45, 2.6, 9.5, "em2");
  box(s, "Send", 0.5, 4.1, 1.2, 0.5, HEX.accent1, "f1"); box(s, "Recipient signs in\nverified email", 2.0, 4.1, 1.9, 0.5, HEX.accent6, "f2"); box(s, "Accept", 4.2, 4.1, 1.2, 0.5, HEX.accent2, "f3"); box(s, "Collaborator added", 5.7, 4.1, 1.7, 0.5, HEX.accent4, "f4"); box(s, "Ownership requested", 7.7, 4.1, 1.8, 0.5, HEX.accent3, "f5");
  arrow(s, 1.7, 4.35, 2.0, 4.35, "fa1"); arrow(s, 3.9, 4.35, 4.2, 4.35, "fa2"); arrow(s, 5.4, 4.35, 5.7, 4.35, "fa3"); arrow(s, 7.4, 4.35, 7.7, 4.35, "fa4");
  cornerMascot(s, "wave");
  s.addNotes("The handoff flow calls the same GitHub APIs a manager would click through, at the moment of acceptance, from a record of what was handed over.");

  // ---------- deployment and quality ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Workflow" });
  title(s, "Deployment, operations and quality");
  panel(s, "Deployment", ["Render web service from a Dockerfile; render.yaml declares every env var", "Self-warm on boot: demo repositories analysed before the first visitor", "Keep-alive ping so the free instance stays awake", "Upstash Redis mirror (optional) keeps analyses, briefs and records across redeploys"], 0.5, 1.2, 2.9, 2.2, 9.5, "dq1");
  panel(s, "Operations", ["/api/health validates the OAuth pair against GitHub, checks the server token quota, the model config and the mail provider login", "scripts/doctor and scripts/warm for local and remote checks", "Mail log line per message; audit log per organisation action", "Developer sign-in presets (alice, bob, carol) for demos without GitHub"], 3.55, 1.2, 2.9, 2.2, 9.5, "dq2");
  panel(s, "Quality", ["TypeScript strict, ESLint with React compiler rules", "64 automated tests: scoring, access rules, import resolver, path safety, rate limits, organisations, quiz grading, dates, packet, email template", "Independent security review, findings fixed same day", "Light and dark themes with Primer tokens; printable packet and letters"], 6.6, 1.2, 2.9, 2.2, 9.5, "dq3");
  const chips2 = ["Next.js 16", "React 19", "TypeScript", "Tailwind v4", "zod", "nodemailer", "Groq", "GitHub API", "Render", "Docker", "Upstash", "Brevo"];
  chips2.forEach((t, i) => {
    const x = 0.5 + (i % 6) * 1.52, y = 3.6 + Math.floor(i / 6) * 0.5;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 1.42, h: 0.4, fill: { color: C.background2 }, line: { color: BORDER, width: 1 }, rectRadius: 0.2, objectName: `chip2-${i}` });
    s.addText(t, { x, y, w: 1.42, h: 0.4, fontSize: 10.5, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `chip2-t-${i}` });
  });
  s.addText("Everything above runs on free tiers. Total monthly cost today: $0.", { x: 0.5, y: 4.7, w: 7.0, h: 0.35, fontSize: 11, italic: true, color: C.accent2, margin: 0, isTextBox: true, objectName: "dq-note" });
  cornerMascot(s, "party");
  s.addNotes("Free to run is a feature: a company can self-host in an afternoon.");
  // ---------- 8. why different ----------
  pres.addSection({ title: "Why us" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Why us" });
  title(s, "Why not just use…");
  const hdr = { bold: true, color: HEX.dk1, fill: { color: HEX.lt2 }, fontSize: 11.5, border: { type: "solid", color: BORDER, pt: 0.75 } };
  const cell = { color: HEX.dk2, fontSize: 10.5, border: { type: "solid", color: BORDER, pt: 0.75 }, valign: "middle" };
  const cellStrong = { ...cell, color: HEX.dk1 };
  const rows = [
    [{ text: "What people use", options: hdr }, { text: "What it tells you", options: hdr }, { text: "What it misses", options: hdr }],
    [{ text: "GitHub blame and Insights", options: cellStrong }, { text: "Who wrote a line, commit volume", options: cell }, { text: "No idea who is gone, so no idea what is unowned", options: cell }],
    [{ text: "CODEOWNERS", options: cellStrong }, { text: "Who should review", options: cell }, { text: "Hand-written, goes stale, still names the person who left", options: cell }],
    [{ text: "Copilot, Cursor", options: cellStrong }, { text: "What the code does, from the code", options: cell }, { text: "Not why it exists; no citations; no handover", options: cell }],
    [{ text: "Notion handover docs", options: cellStrong }, { text: "A place to write", options: cell }, { text: "Blank page: nobody knows which 10 of 3,000 files matter", options: cell }],
    [{ text: "CodeScene", options: cellStrong }, { text: "Knowledge maps, hotspots", options: cell }, { text: "Enterprise add-on that stops at the map", options: cell }],
  ];
  s.addTable(rows, { x: 0.5, y: 1.2, w: 6.3, colW: [1.7, 1.9, 2.7], rowH: 0.5, fontFace: "Calibri", margin: 0.06, objectName: "compare-table" });
  s.addText("We read the history to answer the question GitHub never asks: what breaks when this person leaves?", { x: 0.5, y: 4.4, w: 6.3, h: 0.6, fontSize: 12, italic: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "diff-line" });
  mascot(s, "idea", 7.25, 1.2, 2.4);
  bubble(s, "GitHub stores the history. We ask it questions.", 6.95, 3.75, 2.6, 0.75, "left");
  s.addNotes("Counter each comparison with the row. The closing line is the pitch: GitHub stores history; we interrogate it.");

  // ---------- 9. built and live ----------
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Why us" });
  title(s, "Built, deployed, and free to run");
  const stack = ["Next.js 16", "TypeScript", "git blame + log", "Groq gpt-oss (free)", "GitHub OAuth", "Render", "Brevo email", "Upstash (optional)"];
  stack.forEach((t, i) => {
    const x = 0.5 + (i % 4) * 1.55, y = 1.2 + Math.floor(i / 4) * 0.55;
    s.addShape(pres.ShapeType.roundRect, { x, y, w: 1.45, h: 0.42, fill: { color: C.background2 }, line: { color: BORDER, width: 1 }, rectRadius: 0.21, objectName: `chip-${i}` });
    s.addText(t, { x, y, w: 1.45, h: 0.42, fontSize: 11, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: `chip-t-${i}` });
  });
  const facts = [
    { n: "Live", l: "on Render with GitHub sign-in and real email", c: HEX.accent2 },
    { n: "64", l: "automated tests, type-checked and linted on every commit", c: HEX.accent1 },
    { n: "$0", l: "to run: every service on a free tier", c: HEX.accent4 },
  ];
  facts.forEach((f, i) => {
    const x = 0.5 + i * 2.1;
    card(s, x, 2.55, 1.95, 1.55, `fact-card-${i}`);
    s.addText(f.n, { x: x + 0.15, y: 2.62, w: 1.65, h: 0.7, fontSize: 30, bold: true, color: f.c, margin: 0, isTextBox: true, objectName: `fact-n-${i}` });
    s.addText(f.l, { x: x + 0.15, y: 3.32, w: 1.68, h: 0.72, fontSize: 10.5, color: C.text2, margin: 0, isTextBox: true, objectName: `fact-l-${i}` });
  });
  s.addText([
    { text: "Next: ", options: { bold: true, color: C.text1 } },
    { text: "Slack and Jira signals for pending work, GitLab and Bitbucket, a weekly bus-factor digest per organisation, team-level risk." },
  ], { x: 0.5, y: 4.35, w: 6.4, h: 0.6, fontSize: 11.5, color: C.text2, margin: 0, isTextBox: true, objectName: "next-line" });
  mascot(s, "wave", 7.25, 1.15, 2.4);
  bubble(s, "Try it on your own repo during the Q&A.", 7.0, 3.7, 2.5, 0.7, "left");
  s.addNotes("Invite the judges to paste any public repo URL. Public repos need no sign-in.");

  // ---------- 10. thanks ----------
  s = pres.addSlide({ masterName: "COVER", sectionTitle: "Why us" });
  s.addShape(pres.ShapeType.ellipse, { x: -1.5, y: -1.5, w: 6, h: 6, fill: { color: HEX.accent2, transparency: 90 }, line: { color: HEX.accent2, transparency: 100 }, objectName: "bg-glow" });
  mascot(s, "party", 0.9, 0.9, 3.6);
  s.addText("Thanks for reading", { x: 4.9, y: 1.5, w: 4.7, h: 0.9, fontSize: 40, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "thanks-title" });
  s.addText("Casper has the day-one packet ready for whoever comes next.", { x: 4.9, y: 2.4, w: 4.5, h: 0.8, fontSize: 16, color: C.text2, margin: 0, isTextBox: true, objectName: "thanks-sub" });
  s.addShape(pres.ShapeType.roundRect, { x: 4.9, y: 3.4, w: 3.6, h: 0.55, fill: { color: HEX.accent2 }, line: { color: HEX.accent2, width: 0 }, rectRadius: 0.08, objectName: "cta-bg" });
  s.addText("ghost-architect.onrender.com", { x: 4.9, y: 3.4, w: 3.6, h: 0.55, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "cta-text" });
  s.addText("github.com/yabhinav1/ghost-architect  ·  hackCBS 2026", { x: 4.9, y: 4.1, w: 4.6, h: 0.4, fontSize: 11, color: C.text2, margin: 0, isTextBox: true, objectName: "thanks-links" });
  s.addNotes("End. Offer the live demo.");

  await pres.writeFile({ fileName: "ghost-architect.pptx" });
  await applyTheme("ghost-architect.pptx", THEME);
  console.log("deck written");
})().catch((e) => { console.error(e); process.exit(1); });
