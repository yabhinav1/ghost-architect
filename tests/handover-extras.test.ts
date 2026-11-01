import assert from "node:assert/strict";
import { test } from "node:test";
import { dayDiff } from "../src/lib/dates.ts";
import { grade } from "../src/lib/quiz.ts";
import { packetMarkdown, type Packet } from "../src/lib/packet.ts";

test("dayDiff counts calendar days across month and DST boundaries", () => {
  assert.equal(dayDiff("2026-11-01", "2026-11-01"), 0);
  assert.equal(dayDiff("2026-11-01", "2026-11-15"), 14);
  assert.equal(dayDiff("2026-10-25", "2026-11-01"), 7);
  assert.equal(dayDiff("2026-11-10", "2026-11-01"), -9);
});

test("grade scores only exact matches and tolerates missing answers", () => {
  const quiz = { generatedAt: "", generatedBy: "a", attempts: [], questions: [
    { id: "1", file: "a.ts", question: "q", choices: ["x", "y"], answer: 1, explanation: "" },
    { id: "2", file: "a.ts", question: "q", choices: ["x", "y"], answer: 0, explanation: "" },
    { id: "3", file: "a.ts", question: "q", choices: ["x", "y"], answer: 0, explanation: "" },
  ] };
  assert.deepEqual(grade(quiz, [1, 0, 0]), { score: 3, total: 3 });
  assert.deepEqual(grade(quiz, [1, 1]), { score: 1, total: 3 });
  assert.deepEqual(grade(quiz, []), { score: 0, total: 3 });
});

test("packetMarkdown renders the sections the receiver needs", () => {
  const p: Packet = {
    handover: { id: "h1", repoUrl: "https://github.com/acme/pay", status: "open", dueDate: "2026-11-20", createdAt: "2026-11-01T00:00:00Z" },
    org: { name: "Acme", slug: "acme" },
    leaver: { login: "bob", name: "Bob", lastDay: "2026-11-21" },
    receiver: { login: "eve", name: "Eve" },
    files: [{ path: "src/retry.ts", done: false, notes: "Backoff is tuned for Stripe; do not lower.", links: ["https://x.test/doc"], score: 72, commits12m: 9, inbound: 3, purpose: "Retries failed charges.", risks: ["No test for the jitter path"], checklist: ["Run the billing suite"], undocumented: [], evidence: [{ title: "Add retry", url: "https://github.com/acme/pay/commit/abc", date: "2026-03-01T00:00:00Z" }] }],
    pending: { repoUrl: "https://github.com/acme/pay", login: "bob", pullRequests: [{ number: 4, title: "Fix jitter", url: "https://github.com/acme/pay/pull/4", updatedAt: "2026-10-30T00:00:00Z", kind: "pr" }], issues: [], branches: [{ name: "bob/jitter", unmerged: 2, lastCommit: "2026-10-29T00:00:00Z" }], todos: [], notes: [], computedAt: "2026-11-01T10:00:00Z" },
    readiness: { score: 31, label: "not ready", reasons: ["1 file not walked through"] },
    quiz: { questions: 5, best: { score: 3, total: 5, at: "2026-11-01T00:00:00Z" }, passed: false },
    firstWeek: ["Clone the repo"],
    daysLeft: 20,
    generatedAt: "2026-11-01T10:00:00Z",
  };
  const md = packetMarkdown(p);
  for (const needle of ["# Day-one packet: acme/pay", "Bob (@bob) → Eve (@eve)", "**31/100, not ready**", "3/5, not yet passed", "## First week", "### ⬜ src/retry.ts", "criticality 72", "Backoff is tuned for Stripe", "- [ ] Run the billing suite", "[#4 Fix jitter](https://github.com/acme/pay/pull/4)", "bob/jitter (2 unmerged"]) {
    assert.ok(md.includes(needle), `missing: ${needle}`);
  }
});
