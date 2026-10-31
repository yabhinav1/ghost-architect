import assert from "node:assert/strict";
import { test } from "node:test";
import { activityWindow, dailyFromCommits, utcDay } from "../src/lib/activity.ts";

test("daily activity uses UTC dates and counts commits once across author aliases", () => {
  const activity = dailyFromCommits([
    { date: "2026-10-31T23:30:00-04:00", email: "ALICE@example.test" },
    { date: "2026-11-01T08:00:00+05:30", email: "alice@example.test" },
    { date: "2026-11-01T09:00:00Z", email: "bob@example.test" },
    { date: "invalid", email: "ignored@example.test" },
  ]);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].date, "2026-11-01");
  assert.equal(activity[0].commits, 3);
  assert.equal(activity[0].authors["alice@example.test"], 2);
  assert.equal(utcDay("invalid"), null);
});

test("activity windows include quiet days, exclude out-of-range commits and track selected leavers", () => {
  const activity = dailyFromCommits([
    { date: "2026-10-20T12:00:00Z", email: "old@example.test" },
    { date: "2026-10-26T12:00:00Z", email: "alice@example.test" },
    { date: "2026-11-01T01:00:00Z", email: "alice@example.test" },
    { date: "2026-11-01T01:00:00Z", email: "bob@example.test" },
    { date: "2026-11-02T12:00:00Z", email: "future@example.test" },
  ]);
  const result = activityWindow({ activity, analyzedAt: "2026-11-01T14:00:00Z" }, 7, new Set(["ALICE@example.test"]));
  assert.equal(result.days[0].date, "2026-10-26");
  assert.equal(result.days.at(-1)?.date, "2026-11-01");
  assert.equal(result.days[1].commits, 0);
  assert.equal(result.commits, 3);
  assert.equal(result.activeDays, 2);
  assert.equal(result.contributors, 2);
  assert.equal(result.departedCommits, 2);
  assert.equal(result.partial, false);
});

test("old cached analyses are labelled incomplete and full daily totals override capped detail lists", () => {
  const commits = [{ date: "2026-11-01T00:00:00Z", email: "alice@example.test", name: "Alice", sha: "abc", subject: "Change", files: 2 }];
  const legacy = activityWindow({ commits, analyzedAt: "2026-11-01T12:00:00Z" }, 30);
  assert.equal(legacy.partial, true);
  assert.equal(legacy.commits, 1);
  const activity = dailyFromCommits(Array.from({ length: 450 }, () => commits[0]));
  const complete = activityWindow({ commits, activity, analyzedAt: "2026-11-01T12:00:00Z" }, 30);
  assert.equal(complete.partial, false);
  assert.equal(complete.commits, 450);
  assert.equal(activityWindow({ analyzedAt: "2026-11-01T12:00:00Z" }, 7).commits, 0);
});
