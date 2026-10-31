import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type Visibility = "public" | "private" | "missing" | "unknown";

/**
 * Pure access decision (no Next.js imports, so it is unit-testable).
 *  - public: anyone.
 *  - private: only a signed-in user whose token could read it (the lookup already used their token).
 *  - missing: GitHub says 404. For an anonymous caller that may just mean "private"; for a signed-in caller it is really gone.
 *  - unknown: GitHub could not be asked (rate limit). Allow only if a cached analysis recorded the repo as public.
 */
export function decideAccess(vis: Visibility, signedIn: boolean, cachedPrivate: boolean | undefined): { ok: boolean; status?: number; message?: string } {
  if (vis === "public") return { ok: true };
  if (vis === "private") return signedIn ? { ok: true } : { ok: false, status: 401, message: "This repository is private. Sign in with GitHub to view it." };
  if (vis === "missing") return { ok: false, status: 404, message: signedIn ? "Repository not found, or your account cannot see it." : "Repository not found. If it is private, sign in with GitHub." };
  if (cachedPrivate === false) return { ok: true };
  return { ok: false, status: 503, message: signedIn ? "GitHub could not confirm your access right now. Try again in a minute." : "GitHub is rate-limiting this server, so access cannot be checked. Sign in with GitHub or try again in a few minutes." };
}

const run = promisify(execFile);

/**
 * API-free visibility probe: an anonymous `git ls-remote` succeeds on a public repo and fails on a
 * private or missing one (prompts disabled). Used when GitHub's REST API is rate-limiting the host.
 */
export async function probeWithGit(url: string): Promise<Visibility> {
  try {
    // Public only when git can list at least one ref anonymously. A private repo yields an empty
    // advertisement or an auth error; neither counts.
    // Isolated from every credential source: no helpers, no system or global config, no prompts.
    const { stdout } = await run(
      "git",
      ["-c", "credential.helper=", "ls-remote", "--exit-code", url + ".git"],
      { timeout: 15000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } },
    );
    return stdout.trim().length > 0 ? "public" : "missing";
  } catch {
    return "missing"; // auth required (private) or not found
  }
}
