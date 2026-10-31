import assert from "node:assert/strict";
import { test } from "node:test";
import { decideAccess } from "../src/lib/access-rules.ts";

test("public repos are open to everyone", () => {
  assert.equal(decideAccess("public", false, undefined).ok, true);
  assert.equal(decideAccess("public", true, undefined).ok, true);
});

test("private repos need a signed-in user whose token could read them", () => {
  const anon = decideAccess("private", false, undefined);
  assert.equal(anon.ok, false);
  assert.equal(anon.status, 401);
  assert.equal(decideAccess("private", true, undefined).ok, true);
});

test("missing means 404, worded differently for anonymous callers", () => {
  const anon = decideAccess("missing", false, undefined);
  const user = decideAccess("missing", true, undefined);
  assert.equal(anon.status, 404);
  assert.equal(user.status, 404);
  assert.match(anon.message!, /sign in/i);
  assert.doesNotMatch(user.message!, /sign in/i);
});

test("when GitHub cannot be asked, only a cached public analysis is served", () => {
  assert.equal(decideAccess("unknown", false, false).ok, true);
  assert.equal(decideAccess("unknown", false, true).ok, false);
  assert.equal(decideAccess("unknown", false, undefined).ok, false);
  assert.equal(decideAccess("unknown", true, undefined).status, 503);
});
