import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { seal, unseal } from "../src/lib/session-crypto.ts";

test("session encryption rejects unsafe configuration and forged or tampered cookies", (t) => {
  const original = { ...process.env };
  t.after(() => { process.env = original; });
  delete process.env.AUTH_SECRET;
  delete process.env.GITHUB_CLIENT_SECRET;
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.throws(() => seal({ login: "admin" }), /Set AUTH_SECRET/);

  // A cookie made using the old public fallback must never authenticate.
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update("ghost-architect-dev-secret").digest(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify({ login: "admin" })), cipher.final()]);
  const forged = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
  assert.equal(unseal(forged), null);

  process.env.AUTH_SECRET = "test-only-random-secret-" + randomBytes(32).toString("hex");
  const session = { login: "alice", token: "fake-token" };
  const cookie = seal(session);
  assert.deepEqual(unseal(cookie), session);
  const tampered = Buffer.from(cookie, "base64url");
  tampered[tampered.length - 1] ^= 1;
  assert.equal(unseal(tampered.toString("base64url")), null);
  assert.equal(unseal(forged), null);
  process.env.AUTH_SECRET = "a-different-test-secret";
  assert.equal(unseal(cookie), null);

  delete process.env.AUTH_SECRET;
  process.env.GITHUB_CLIENT_SECRET = "test-oauth-client-secret";
  assert.deepEqual(unseal(seal(session)), session);
  delete process.env.GITHUB_CLIENT_SECRET;
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.deepEqual(unseal(seal(session)), session);
  assert.equal(unseal(forged), null);
});
