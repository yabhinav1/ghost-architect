import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRepoPath, normalizeRepoUrl, repoKey } from "../src/lib/git.ts";

test("GitHub URLs normalise to one canonical form regardless of case, www, .git, slashes, query", () => {
  const canon = "https://github.com/yabhinav1/ghost-architect";
  for (const v of [canon, canon + "/", canon + ".git", canon + "?x=1#top", "https://GITHUB.com/Yabhinav1/Ghost-Architect", "https://www.github.com/yabhinav1/ghost-architect", "https://github.com/yabhinav1/ghost-architect/tree/main/src"]) {
    assert.equal(normalizeRepoUrl(v), canon, v);
    assert.equal(repoKey(v), repoKey(canon), v);
  }
});

test("credentials embedded in a URL are stripped; non-GitHub hosts keep their path", () => {
  assert.equal(normalizeRepoUrl("https://user:tok@github.com/a/b"), "https://github.com/a/b");
  assert.equal(normalizeRepoUrl("https://gitlab.com/Group/Sub/Repo.git/"), "https://gitlab.com/Group/Sub/Repo");
});

test("bad URLs are rejected", () => {
  assert.throws(() => normalizeRepoUrl("github.com/a/b"));
  assert.throws(() => normalizeRepoUrl("https://github.com/onlyowner"));
});

test("repo paths must stay inside the working tree", () => {
  assert.equal(assertRepoPath("lib/utils.js"), "lib/utils.js");
  assert.equal(assertRepoPath("./lib/utils.js"), "lib/utils.js");
  // any ".." segment is rejected outright, even ones that would stay inside the tree
  for (const bad of ["../.env.local", "lib/../../x", "./lib/a/../utils.js", "/etc/passwd", "C:\\win.ini", "a\\..\\b", "", "lib/\0x"]) {
    assert.throws(() => assertRepoPath(bad), bad);
  }
});
