/** Small, dependency-free helpers for reading deployment configuration. */

const TOKEN_SHAPE = /^(github_pat_|ghp_|gho_|ghu_|ghs_)/;

export function looksLikeGithubToken(value: string | undefined): boolean {
  return Boolean(value && TOKEN_SHAPE.test(value));
}

/**
 * The server's own GitHub API token. Prefers GITHUB_TOKEN. If a personal access token was pasted
 * into GITHUB_CLIENT_SECRET by mistake, it is still used here for API quota (it cannot serve as an
 * OAuth secret anyway), so a misconfigured deploy keeps working for public repos.
 */
export function serverGithubToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (looksLikeGithubToken(process.env.GITHUB_CLIENT_SECRET)) return process.env.GITHUB_CLIENT_SECRET;
  return undefined;
}

/** Years of git history to read. Bounded so the one-pass log stays tractable on small hosts. */
export const HISTORY_YEARS = Math.min(10, Math.max(1, Number(process.env.HISTORY_YEARS ?? 4) || 4));
