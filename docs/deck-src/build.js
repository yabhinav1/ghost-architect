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
