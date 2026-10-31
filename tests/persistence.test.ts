import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "node:test";

test("durable organisation storage survives restarts and partial recovery", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ghost-db-test-"));
  const original = { ...process.env };
  Object.assign(process.env, { GHOST_CACHE_DIR: root, UPSTASH_REDIS_REST_URL: "https://redis.test", UPSTASH_REDIS_REST_TOKEN: "fake-test-token" });
  t.after(async () => { process.env = original; await fs.rm(root, { recursive: true, force: true }); });
  const remote = new Map<string, string>();
  const commands: (string | number)[][] = [];
  let fail = false;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://redis.test");
    if (fail) return new Response("unavailable", { status: 503 });
    const args = JSON.parse(String(init.body)) as (string | number)[];
    commands.push(args);
    let result: unknown = null;
    if (args[0] === "GET") result = remote.get(String(args[1])) ?? null;
    else if (args[0] === "SET") { remote.set(String(args[1]), String(args[2])); result = "OK"; }
    else assert.fail(`Unexpected command: ${args[0]}`);
    return Response.json({ result });
  });
  const db = await import("../src/lib/db.ts");
  const store = await import("../src/lib/store.ts");
  const reset = async () => { remote.clear(); commands.length = 0; await fs.rm(path.join(root, "db"), { recursive: true, force: true }); };

  await t.test("new records restore after the entire local database is lost", async () => {
    await db.put("orgs", { id: "a", name: "Acme" });
    await db.put("orgs", { id: "b", name: "Beta" });
    await fs.rm(path.join(root, "db"), { recursive: true });
    assert.deepEqual((await db.list<{ id: string }>("orgs")).map((r) => r.id).sort(), ["a", "b"]);
    assert.ok(commands.filter((c) => c[0] === "SET").every((c) => c.length === 3), "business records and indexes must have no expiry");
  });

  await t.test("one restored record and a new write do not hide other remote records", async () => {
    await fs.rm(path.join(root, "db"), { recursive: true });
    await db.get("orgs", "a");
    await db.put("orgs", { id: "c", name: "Gamma" });
    assert.deepEqual((await db.list<{ id: string }>("orgs")).map((r) => r.id).sort(), ["a", "b", "c"]);
    await db.del("orgs", "b");
    await fs.rm(path.join(root, "db"), { recursive: true });
    assert.deepEqual((await db.list<{ id: string }>("orgs")).map((r) => r.id).sort(), ["a", "c"]);
    assert.equal(await db.get("orgs", "b"), null);
  });

  await t.test("simultaneous writes preserve every index entry", async () => {
    await reset();
    await Promise.all(Array.from({ length: 12 }, (_, i) => db.put("members", { id: `org:user${i}` })));
    await fs.rm(path.join(root, "db"), { recursive: true });
    assert.equal((await db.list("members")).length, 12);
  });

  await t.test("startup repairs legacy missing indexes and removes record expiry", async () => {
    await reset();
    await fs.mkdir(path.join(root, "db", "orgs"), { recursive: true });
    await fs.writeFile(path.join(root, "db", "orgs", "local.json"), JSON.stringify({ id: "local" }));
    const pack = (v: unknown) => gzipSync(JSON.stringify(v)).toString("base64");
    remote.set("db:orgs:index", pack(["remote"]));
    remote.set("db:orgs:remote", pack({ id: "remote" }));
    await db.repairDurableRecords();
    await fs.rm(path.join(root, "db"), { recursive: true });
    assert.deepEqual((await db.list<{ id: string }>("orgs")).map((r) => r.id).sort(), ["local", "remote"]);
    assert.ok(commands.some((c) => c[0] === "SET" && c[1] === "db:orgs:remote" && c.length === 3));
  });

  await t.test("temporary analysis caches still expire", async () => {
    await store.storeSet("analysis:test", { files: [] });
    assert.deepEqual(commands.at(-1)?.slice(3), ["EX", 14 * 24 * 3600]);
  });

  await t.test("a Redis outage is reported without overwriting the index", async () => {
    const before = remote.get("db:orgs:index");
    fail = true;
    await assert.rejects(db.put("orgs", { id: "failed" }), /upstash 503/);
    await assert.rejects(store.storeSet("db:orgs:failed", {}, { persistent: true }), /upstash 503/);
    fail = false;
    assert.equal(remote.get("db:orgs:index"), before);
    assert.equal(await db.get("orgs", "failed"), null);
    await db.put("orgs", { id: "recovered" });
    assert.ok(await db.get("orgs", "recovered"));
  });
});
