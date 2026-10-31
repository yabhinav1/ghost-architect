import assert from "node:assert/strict";
import { test } from "node:test";
import { codeownersText, decayCurve, handoverPlan, portfolioSummary, scoreFilesAt, suggestReceiver } from "../src/lib/insights.ts";
import { scoreFiles } from "../src/lib/score.ts";
import type { Analysis, FileStat } from "../src/lib/types.ts";

const file = (over: Partial<FileStat>): FileStat => ({
  path: "lib/a.ts",
  lines: 100,
  authors: {},
  commitAuthors: {},
  commits12m: 0,
  commits24m: 0,
  inbound: 0,
  lastTouched: "2026-10-01",
  lastAuthor: "",
  timeline: [],
  ...over,
});

const analysis = (files: FileStat[]): Analysis => {
  const authors: Analysis["authors"] = {};
  for (const f of files) {
    for (const [e, n] of Object.entries(f.authors)) (authors[e] ??= { name: e.split("@")[0], lines: 0, commits: 0 }).lines += n;
    for (const [e, n] of Object.entries(f.commitAuthors)) (authors[e] ??= { name: e.split("@")[0], lines: 0, commits: 0 }).commits += n;
  }
  return { repoUrl: "https://github.com/org/repo", analyzedAt: "2026-10-31T00:00:00Z", totalFiles: files.length, analysedFiles: files.length, files, authors };
};

test("nothing is orphaned when nobody has left", () => {
  const scored = scoreFiles([file({ authors: { "a@x.com": 100 }, commits12m: 10, inbound: 3 })], new Set());
  assert.equal(scored[0].score, 0);
  assert.equal(scored[0].orphanShare, 0);
});

test("orphan share blends 60% blame with 40% commits", () => {
  const f = file({ authors: { "a@x.com": 50, "b@x.com": 50 }, commitAuthors: { "a@x.com": 9, "b@x.com": 1 }, commits24m: 10, commits12m: 5 });
  const [s] = scoreFiles([f], new Set(["a@x.com"]));
  assert.equal(s.blameShare, 0.5);
  assert.equal(s.commitShare, 0.9);
  assert.ok(Math.abs(s.orphanShare - (0.6 * 0.5 + 0.4 * 0.9)) < 1e-9);
});

test("a file with no recent commits falls back to blame share for the commit signal", () => {
  const f = file({ authors: { "a@x.com": 80, "b@x.com": 20 } });
  const [s] = scoreFiles([f], new Set(["a@x.com"]));
  assert.equal(s.commitShare, s.blameShare);
});

test("the riskiest file scores 100 and ordering follows churn and importers", () => {
  const quiet = file({ path: "quiet.ts", authors: { "a@x.com": 100 }, commits12m: 1, inbound: 0 });
  const hot = file({ path: "hot.ts", authors: { "a@x.com": 100 }, commits12m: 20, inbound: 8 });
  const scored = scoreFiles([quiet, hot], new Set(["a@x.com"]));
  assert.equal(scored[0].path, "hot.ts");
  assert.equal(scored[0].score, 100);
  assert.ok(scored[1].score > 0 && scored[1].score < 100);
});

test("emails are matched case-insensitively", () => {
  const [s] = scoreFiles([file({ authors: { "A@X.com": 100 }, commits12m: 1 })], new Set(["a@x.com"]));
  assert.equal(s.blameShare, 1);
});

test("suggestReceiver picks the still-here author with the most lines", () => {
  const f = file({ authors: { "gone@x.com": 70, "stay@x.com": 20, "other@x.com": 10 } });
  const r = suggestReceiver(f, new Set(["gone@x.com"]), analysis([f]).authors);
  assert.equal(r?.email, "stay@x.com");
});

test("suggestReceiver returns null when everyone who touched the file has left", () => {
  const f = file({ authors: { "gone@x.com": 100 } });
  assert.equal(suggestReceiver(f, new Set(["gone@x.com"]), {}), null);
});

test("handoverPlan lists only the leaver's files, riskiest first", () => {
  const theirs = file({ path: "theirs.ts", authors: { "gone@x.com": 90, "stay@x.com": 10 }, commits12m: 5, inbound: 2 });
  const notTheirs = file({ path: "other.ts", authors: { "stay@x.com": 100 }, commits12m: 5 });
  const plan = handoverPlan(analysis([theirs, notTheirs]), "gone@x.com");
  assert.deepEqual(plan.map((p) => p.file.path), ["theirs.ts"]);
  assert.equal(plan[0].receiver?.email, "stay@x.com");
});

test("codeownersText assigns a still-here owner and flags files with nobody left", () => {
  const a = file({ path: "a.ts", authors: { "gone@x.com": 60, "stay@x.com": 40 }, commits12m: 10, inbound: 2 });
  const b = file({ path: "b.ts", authors: { "gone@x.com": 100 }, commits12m: 10, inbound: 2 });
  const an = analysis([a, b]);
  const departed = new Set(["gone@x.com"]);
  const text = codeownersText(scoreFiles(an.files, departed), departed, an.authors, 0);
  assert.match(text, /^\/a\.ts stay@x\.com/m);
  assert.match(text, /^\/b\.ts\s+# score \d+, NO remaining author/m);
});

test("scoreFilesAt only counts commits before the as-of date", () => {
  const f = file({
    timeline: [
      { d: "2026-09-01", a: "gone@x.com" },
      { d: "2025-03-01", a: "stay@x.com" },
    ],
  });
  const before = scoreFilesAt([f], new Set(["gone@x.com"]), new Date("2026-01-01"));
  const after = scoreFilesAt([f], new Set(["gone@x.com"]), new Date("2026-10-01"));
  assert.equal(before[0].commitShare, 0);
  assert.equal(after[0].commitShare, 0.5);
});

test("decayCurve measures how much of a leaver's code others touched afterwards", () => {
  const touched = file({ path: "t.ts", timeline: [{ d: "2026-03-01", a: "stay@x.com" }, { d: "2026-01-10", a: "gone@x.com" }] });
  const rotting = file({ path: "r.ts", timeline: [{ d: "2026-01-05", a: "gone@x.com" }] });
  const c = decayCurve([touched, rotting], "gone@x.com", 3);
  assert.ok(c);
  assert.equal(c.lastCommit, "2026-01-10");
  assert.equal(c.files, 2);
  assert.equal(c.points[0].absorbed, 0);
  assert.equal(c.points[c.points.length - 1].absorbed, 0.5);
});

test("portfolioSummary computes bus factor and flags single-owner repos as fragile", () => {
  const a = file({ path: "a.ts", authors: { "solo@x.com": 95, "b@x.com": 5 }, commits12m: 3 });
  const b = file({ path: "b.ts", authors: { "solo@x.com": 100 }, commits12m: 0 });
  const s = portfolioSummary(analysis([a, b]));
  assert.equal(s.busFactor, 1);
  assert.equal(s.singleOwnerFiles, 2);
  assert.equal(s.fragileFiles, 1);
  assert.equal(s.level, "fragile");
});
