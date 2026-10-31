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
