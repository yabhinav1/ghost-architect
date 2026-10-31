import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, rateLimit } from "../src/lib/ratelimit.ts";

const req = (ip: string, extra: Record<string, string> = {}) => new Request("http://x/", { headers: { "x-forwarded-for": ip, ...extra } });

test("anonymous callers get 10 analyses per address, then 429 with a retry hint", () => {
  const ip = "198.51.100.1";
  for (let i = 0; i < 10; i++) assert.equal(rateLimit(req(ip), "analyze", null).ok, true, `call ${i + 1}`);
  const r = rateLimit(req(ip), "analyze", null);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.scope, "you");
    assert.equal(r.limit, 10);
    assert.ok(r.retryAfterSec >= 1);
  }
  assert.equal(rateLimit(req("198.51.100.2"), "analyze", null).ok, true, "another address is unaffected");
});

test("signed-in users are keyed by login with a higher limit, independent of address", () => {
  for (let i = 0; i < 30; i++) assert.equal(rateLimit(req(`203.0.113.${i % 5}`), "analyze", "alice").ok, true, `call ${i + 1}`);
  assert.equal(rateLimit(req("203.0.113.9"), "analyze", "alice").ok, false);
  assert.equal(rateLimit(req("203.0.113.9"), "analyze", "bob").ok, true);
});

test("batch cost is charged up front", () => {
  const r = rateLimit(req("198.51.100.50"), "llm", null, 15);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.remaining, 15);
  assert.equal(rateLimit(req("198.51.100.50"), "llm", null, 16).ok, false);
});

test("a server-wide ceiling stops floods from many spoofed addresses", () => {
  let ok = 0;
  for (let i = 0; i < 500; i++) if (rateLimit(req(`10.1.${Math.floor(i / 250)}.${i % 250}`), "analyze", null).ok) ok++;
  assert.ok(ok <= 120, `only ${ok} should pass the global ceiling of 120`);
  const r = rateLimit(req("10.9.9.9"), "analyze", null);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.scope, "server");
});

test("client address prefers trusted edge headers", () => {
  assert.equal(clientIp(req("1.1.1.1, 2.2.2.2")), "1.1.1.1");
  assert.equal(clientIp(req("1.1.1.1", { "true-client-ip": "9.9.9.9" })), "9.9.9.9");
  assert.equal(clientIp(new Request("http://x/")), "local");
});
