import fs from "node:fs";
import path from "node:path";
import { cacheDir } from "./git";

/**
 * GitHub app credentials. Either set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in .env.local
 * (an OAuth App or GitHub App you registered by hand) or let /setup create a GitHub App with
 * one click, which stores the result here and appends it to .env.local.
 */
export type AppConfig = { clientId: string; clientSecret: string; slug?: string; name?: string; kind: "oauth-app" | "github-app" };

const FILE = () => cacheDir("github-app.json");
let memo: AppConfig | null | undefined;

export function getAppConfig(): AppConfig | null {
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, slug: process.env.GITHUB_APP_SLUG, kind: process.env.GITHUB_APP_SLUG ? "github-app" : "oauth-app" };
  }
  if (memo !== undefined) return memo;
  try {
    memo = JSON.parse(fs.readFileSync(FILE(), "utf8")) as AppConfig;
  } catch {
    memo = null;
  }
  return memo;
}

export function saveAppConfig(cfg: AppConfig): void {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  memo = cfg;
  // Make it live for this process and persist for the next one.
  process.env.GITHUB_CLIENT_ID = cfg.clientId;
  process.env.GITHUB_CLIENT_SECRET = cfg.clientSecret;
  if (cfg.slug) process.env.GITHUB_APP_SLUG = cfg.slug;
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const strip = existing.split("\n").filter((l) => !/^(GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|GITHUB_APP_SLUG)=/.test(l)).join("\n").replace(/\n+$/, "");
    fs.writeFileSync(envPath, `${strip}\n\n# GitHub App created by /setup on ${new Date().toISOString().slice(0, 10)}\nGITHUB_CLIENT_ID=${cfg.clientId}\nGITHUB_CLIENT_SECRET=${cfg.clientSecret}\n${cfg.slug ? `GITHUB_APP_SLUG=${cfg.slug}\n` : ""}`);
  } catch {
    // .env.local is a convenience; the json file is the source of truth
  }
}
