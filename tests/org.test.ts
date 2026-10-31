import assert from "node:assert/strict";
import { test } from "node:test";
import { fillTemplate, slugify, suggestHandoverFiles, NOTICE_TEMPLATES } from "../src/lib/org.ts";
import { isAdmin, canManage } from "../src/lib/roles.ts";
import type { Analysis, FileStat } from "../src/lib/types.ts";

test("admin logins come from ADMIN_LOGINS, case-insensitively", () => {
  process.env.ADMIN_LOGINS = "Alice, bob";
  assert.equal(isAdmin("alice"), true);
  assert.equal(isAdmin("BOB"), true);
  assert.equal(isAdmin("carol"), false);
  assert.equal(isAdmin(null), false);
  process.env.ADMIN_LOGINS = "";
  assert.equal(isAdmin("alice"), false);
});

test("owners and managers manage; members and support admins do not", () => {
  assert.equal(canManage("owner"), true);
  assert.equal(canManage("manager"), true);
  assert.equal(canManage("member"), false);
  assert.equal(canManage("admin-support"), false);
});

test("slugify and templates", () => {
  assert.equal(slugify("Acme Payments, Inc."), "acme-payments-inc");
  assert.equal(slugify("!!!"), "org");
  const t = fillTemplate(NOTICE_TEMPLATES.layoff.subject, { org: "Acme" });
  assert.equal(t, "Important: changes to your role at Acme");
  assert.equal(fillTemplate("Hi {name}, {missing}", { name: "Ria" }), "Hi Ria, {missing}");
});

test("handover file suggestions favour the leaver's owned, active, imported files", () => {
  const f = (path: string, mine: number, other: number, c12: number, inbound: number, c24 = c12, mineRecent = Math.round(c12 / 2)): FileStat => ({
    path, lines: mine + other, authors: { "lea@x.com": mine, "stay@x.com": other }, commitAuthors: { "lea@x.com": mineRecent, "stay@x.com": c24 - mineRecent }, commits12m: c12, commits24m: c24, inbound, lastTouched: "2026-10-01", lastAuthor: "", timeline: [],
  });
  const a: Analysis = { repoUrl: "https://github.com/o/r", analyzedAt: "", totalFiles: 3, analysedFiles: 3, authors: {}, files: [f("quiet.ts", 100, 0, 0, 0, 0, 0), f("core.ts", 90, 10, 20, 8), f("theirs.ts", 0, 100, 20, 8, 20, 0)] };
  const picks = suggestHandoverFiles(a, "lea@x.com");
  assert.deepEqual(picks.map((p) => p.path), ["core.ts", "quiet.ts"]);
  assert.equal(suggestHandoverFiles(a, undefined).length, 0);
});
