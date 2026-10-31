import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { WorkTransfer, Member } from "../src/lib/types.ts";

test("email work handoffs enforce identity, membership and GitHub permissions", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ghost-transfers-"));
  const original = { ...process.env };
  Object.assign(process.env, { GHOST_CACHE_DIR: root, UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" });
  t.after(async () => { process.env = original; await fs.rm(root, { recursive: true, force: true }); });
  const sender = { login: "alice", token: "alice-token" };
  const receiver = { login: "bob", token: "bob-token" };
  const stranger = { login: "eve", token: "eve-token" };
  let push = true, admin = true, emailsFail = false, inviteStatus = 201, existingPermission = "none";
  const writes: { url: string; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit = {}) => {
    const authorization = new Headers(init.headers).get("Authorization");
    assert.ok(authorization, "GitHub requests use the actor's own token");
    if (String(url).includes("/user/emails")) {
      if (emailsFail) return new Response(null, { status: 403 });
      const name = authorization!.slice(7).replace("-token", "");
      return Response.json([{ email: `${name}@example.com`, verified: true }, { email: "bob@example.com", verified: false }]);
    }
    assert.ok(String(url).startsWith("https://api.github.com/repos/acme/work"));
    if (String(url).endsWith("/permission")) return Response.json({ permission: existingPermission });
    if (init.method === "PUT") {
      writes.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return new Response(null, { status: inviteStatus });
    }
    return Response.json({ permissions: { admin, push }, owner: { type: "Organization" } });
  });
  const db = await import("../src/lib/db.ts");
  const work = await import("../src/lib/work-transfers.ts");
  const { inboxSummary } = await import("../src/lib/inbox.ts");
  const input = { recipientEmail: "BOB@example.com", repoUrl: "https://github.com/acme/work.git", title: "Finish migration", notes: "Run the migration tests; then review PR #42.", branch: "feature/migration" };
  const denied = (status: number) => (e: unknown) => e instanceof work.TransferError && e.status === status;

  await t.test("only verified email receives pending work; no account directory or automatic GitHub writes", async () => {
    const transfer = await work.createTransfer(sender, input);
    assert.equal(transfer.recipientEmail, "bob@example.com");
    assert.equal(transfer.repoUrl, "https://github.com/acme/work");
    assert.equal(transfer.recipientLogin, undefined);
    assert.equal(writes.length, 0);
    assert.equal((await work.transfersFor(stranger)).transfers.length, 0);
    assert.equal((await work.transfersFor(receiver)).transfers[0].id, transfer.id);
    assert.equal((await inboxSummary(receiver)).unread, 1);
    await assert.rejects(work.changeTransfer(stranger, transfer.id, "read"), denied(404));
    await assert.rejects(work.changeTransfer(sender, transfer.id, "accept"), denied(403));
    await assert.rejects(work.inviteTransferCollaborator(sender, transfer.id), denied(409));
    const read = await work.changeTransfer(receiver, transfer.id, "read");
    assert.equal(read.recipientLogin, "bob");
    assert.equal((await inboxSummary(receiver)).unread, 0);
    const accepted = await work.changeTransfer(receiver, transfer.id, "accept");
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.senderReadAt, undefined);
    assert.equal((await inboxSummary(sender)).unread, 1);
    await assert.rejects(work.changeTransfer(receiver, transfer.id, "decline"), denied(409));
    await assert.rejects(work.changeTransfer(sender, transfer.id, "cancel"), denied(409));
    await assert.rejects(work.inviteTransferCollaborator(stranger, transfer.id), denied(404));
    admin = false;
    await assert.rejects(work.inviteTransferCollaborator(sender, transfer.id), denied(403));
    assert.equal(writes.length, 0);
    admin = true; inviteStatus = 403;
    await assert.rejects(work.inviteTransferCollaborator(sender, transfer.id), denied(403));
    assert.equal((await db.get<WorkTransfer>("workTransfers", transfer.id))?.githubAccess, undefined);
    inviteStatus = 201;
    const invited = await work.inviteTransferCollaborator(sender, transfer.id);
    assert.equal(invited.githubAccess, "invited");
    assert.deepEqual(writes.at(-1), { url: "https://api.github.com/repos/acme/work/collaborators/bob", body: { permission: "push" } });
    assert.equal((await inboxSummary(receiver)).unread, 1);
    const count = writes.length;
    await work.inviteTransferCollaborator(sender, transfer.id);
    assert.equal(writes.length, count, "repeated invitations do not write again");
  });

  await t.test("existing stronger permissions are preserved without a write", async () => {
    const transfer = await work.createTransfer(sender, input);
    await work.changeTransfer(receiver, transfer.id, "accept");
    existingPermission = "admin";
    const count = writes.length;
    assert.equal((await work.inviteTransferCollaborator(sender, transfer.id)).githubAccess, "already-access");
    assert.equal(writes.length, count);
    existingPermission = "none";
  });

  await t.test("organisation handoffs require a current owner/manager with verified email", async () => {
    await db.put("orgs", { id: "org", name: "Acme" });
    const member = (login: string, role: Member["role"], status: Member["status"] = "active"): Member => ({ id: `org:${login}`, orgId: "org", login, name: login, email: "bob@example.com", role, status, joinedAt: "2026-01-01" });
    await db.put("members", member("alice", "member"));
    await db.put("members", member("bob", "member"));
    await db.put("members", member("eve", "owner"));
    const transfer = await work.createTransfer(sender, { ...input, orgId: "org" });
    assert.equal(transfer.orgName, "Acme");
    assert.ok(!(await work.transfersFor(receiver)).transfers.some((r) => r.id === transfer.id));
    await assert.rejects(work.changeTransfer(receiver, transfer.id, "accept"), denied(404));
    await assert.rejects(work.changeTransfer(stranger, transfer.id, "accept"), denied(404));
    await db.put("members", member("bob", "manager"));
    await work.changeTransfer(receiver, transfer.id, "read");
    await db.put("members", member("bob", "manager", "left"));
    await assert.rejects(work.changeTransfer(receiver, transfer.id, "accept"), denied(404));
    await db.put("members", member("alice", "member", "left"));
    await assert.rejects(work.createTransfer(sender, { ...input, orgId: "org" }), denied(403));
    await work.changeTransfer(sender, transfer.id, "cancel");
  });

  await t.test("read-only senders, malformed URLs, demo accounts and email lookup failure cannot send", async () => {
    push = false; admin = false;
    await assert.rejects(work.createTransfer(sender, input), denied(403));
    push = true; admin = true;
    await assert.rejects(work.createTransfer(sender, { ...input, recipientEmail: "alice@example.com" }), denied(400));
    await assert.rejects(work.createTransfer(sender, { ...input, recipientEmail: "wrong" }), denied(400));
    await assert.rejects(work.createTransfer(sender, { ...input, repoUrl: "https://evil.example/acme/work" }));
    await assert.rejects(work.createTransfer({ ...sender, token: "" }, input), denied(403));
    const transfer = await work.createTransfer(sender, { ...input, recipientEmail: "new@example.com" });
    emailsFail = true;
    await assert.rejects(work.changeTransfer({ login: "new", token: "new-token" }, transfer.id, "accept"), denied(403));
    await assert.rejects(work.createTransfer(sender, input), denied(403));
    assert.match((await work.transfersFor({ login: "new", token: "new-token" })).emailWarning!, /permission/);
    emailsFail = false;
  });

  await t.test("simultaneous accept/decline cannot both succeed; read preserves the final state", async () => {
    const transfer = await work.createTransfer(sender, input);
    const decisions = await Promise.allSettled([work.changeTransfer(receiver, transfer.id, "accept"), work.changeTransfer(receiver, transfer.id, "decline")]);
    assert.equal(decisions.filter((d) => d.status === "fulfilled").length, 1);
    const record = await work.changeTransfer(receiver, transfer.id, "read");
    assert.equal(record.status, "accepted");
    const another = await work.createTransfer(sender, input);
    await work.changeTransfer(sender, another.id, "cancel");
    await assert.rejects(work.changeTransfer(receiver, another.id, "accept"), denied(409));
  });
});
