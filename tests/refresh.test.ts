import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const run = promisify(execFile);

test("forced analysis fetches new commits and the current default branch", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ghost-refresh-test-"));
  const original = { ...process.env };
  t.after(async () => { process.env = original; await fs.rm(root, { recursive: true, force: true }); });
  const source = path.join(root, "source");
  const remote = path.join(root, "remotes", "owner", "repo.git");
  const config = path.join(root, "gitconfig");
  await fs.mkdir(source);
  await fs.mkdir(path.dirname(remote), { recursive: true });
  await fs.writeFile(config, `[url "file://${root}/remotes/"]\n\tinsteadOf = https://github.com/\n`);
  Object.assign(process.env, { GHOST_CACHE_DIR: path.join(root, "cache"), GHOST_SKIP_PREFLIGHT: "1", GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1" });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const git = async (args: string[], cwd = source) => (await run("git", args, { cwd, env: process.env })).stdout.trim();
  await git(["init", "-b", "main"]);
  await git(["config", "user.email", "alice@example.test"]);
  await git(["config", "user.name", "Alice"]);
  await fs.writeFile(path.join(source, "main.ts"), "export const version = 1;\n");
  await git(["add", "."]);
  await git(["commit", "-m", "Initial version"]);
  await git(["clone", "--bare", source, remote]);
  await git(["remote", "add", "origin", remote]);

  const { analyzeRepo, fileContent, ensureClone } = await import("../src/lib/git.ts");
  const url = "https://github.com/owner/repo";
  const token = "fake-refresh-test-token";
  const first = await analyzeRepo(url, false, undefined, token);
  assert.equal(first.analysedFiles, 1);
  assert.equal(first.activity?.reduce((sum, day) => sum + day.commits, 0), 1);
  await fs.writeFile(path.join(source, "new.ts"), "export const added = true;\n");
  await fs.writeFile(path.join(source, "main.ts"), "export const version = 2;\n");
  await git(["add", "."]);
  await git(["commit", "-m", "Second version"]);
  await git(["push", "origin", "main"]);
  assert.equal((await analyzeRepo(url)).analysedFiles, 1, "ordinary reads still use the cache");
  const progress: string[] = [];
  const updated = await analyzeRepo(url, true, (p) => progress.push(p.step), token);
  assert.equal(updated.analysedFiles, 2);
  assert.equal(updated.activity?.reduce((sum, day) => sum + day.commits, 0), 2, "a commit touching two files is counted once");
  assert.match((await fileContent(url, "main.ts")).text, /version = 2/);
  assert.ok(progress.includes("Fetching latest repository changes"));

  await git(["checkout", "-b", "release"]);
  await fs.writeFile(path.join(source, "main.ts"), "export const version = 3;\n");
  await git(["add", "."]);
  await git(["commit", "-m", "New default branch"]);
  await git(["push", "origin", "release"]);
  await git(["symbolic-ref", "HEAD", "refs/heads/release"], remote);
  await analyzeRepo(url, true, undefined, token);
  assert.match((await fileContent(url, "main.ts")).text, /version = 3/);

  // Create a history longer than the detailed-list cap in one local git process.
  const head = await git(["rev-parse", "HEAD"]);
  const timestamp = Math.floor(Date.now() / 1000);
  const imported = Array.from({ length: 405 }, (_, i) => `commit refs/heads/release\nmark :${i + 1}\ncommitter Alice <alice@example.test> ${timestamp} +0000\ndata 4\nbulk\nfrom ${i ? `:${i}` : head}\n\n`).join("");
  const fast = spawnSync("git", ["fast-import", "--quiet"], { cwd: source, env: process.env, input: imported, encoding: "utf8" });
  assert.equal(fast.status, 0, fast.stderr);
  await git(["push", "origin", "release"]);
  const busyRepo = await analyzeRepo(url, true, undefined, token);
  assert.equal(busyRepo.commits?.length, 400);
  assert.equal(busyRepo.activity?.reduce((sum, day) => sum + day.commits, 0), 408, "daily totals must include commits beyond the detail cap");

  const clone = await ensureClone(url);
  const cloneConfig = await fs.readFile(path.join(clone, ".git", "config"), "utf8");
  assert.ok(!cloneConfig.includes(token));
  assert.ok(!cloneConfig.includes(Buffer.from(`x-access-token:${token}`).toString("base64")));
  await assert.rejects(ensureClone("https://attacker.example/repo", undefined, token), /Only HTTPS GitHub/);

  // A failed fetch must fail visibly, preserve the last analysis and redact command credentials.
  await fs.rename(remote, remote + ".unavailable");
  await assert.rejects(analyzeRepo(url, true, undefined, token), (error: Error) => {
    assert.match(error.message, /Could not refresh/);
    assert.ok(!error.message.includes(token));
    assert.ok(!error.message.includes(Buffer.from(`x-access-token:${token}`).toString("base64")));
    return true;
  });
  assert.equal((await analyzeRepo(url)).analysedFiles, 2);
});
