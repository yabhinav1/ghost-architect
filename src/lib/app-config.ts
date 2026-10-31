import fs from "node:fs";
import path from "node:path";
import { looksLikeGithubToken } from "./env.ts";
import { cacheDir } from "./git.ts";
import { storeGet, storeSet } from "./store.ts";

/**
 * GitHub app credentials. Sources, in order of preference:
 *   1. GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET env (an OAuth App or GitHub App registered by hand)
 *   2. .cache/github-app.json written by /setup (one-click GitHub App), mirrored to the durable store
 * The async resolver validates the env pair against GitHub once (cached) so a wrong secret on the host
 * falls through to /setup instead of breaking sign-in with an opaque error.
 */
export type AppConfig = { clientId: string; clientSecret: string; slug?: string; name?: string; kind: "oauth-app" | "github-app" };
export type ConfigProblem = "missing" | "secret-is-token" | "rejected";

const FILE = () => cacheDir("github-app.json");
let memo: AppConfig | null | undefined;

function envConfig(): AppConfig | null {
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, slug: process.env.GITHUB_APP_SLUG, kind: process.env.GITHUB_APP_SLUG ? "github-app" : "oauth-app" };
  }
  return null;
}

function fileConfig(): AppConfig | null {
  if (memo !== undefined) return memo;
  try {
    memo = JSON.parse(fs.readFileSync(FILE(), "utf8")) as AppConfig;
  } catch {
    memo = null;
  }
  return memo;
}

/** Synchronous view used by pages: env first, then the setup file. Not validated. */
export function getAppConfig(): AppConfig | null {
  return envConfig() ?? fileConfig();
}

/** 404 = credentials accepted but that token does not exist (expected); 401 = bad client id or secret. */
export async function validateClientPair(clientId: string, clientSecret: string): Promise<"ok" | "rejected" | "unknown"> {
  try {
    const res = await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"), Accept: "application/vnd.github+json", "User-Agent": "ghost-architect", "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "ghost-architect-config-check" }),
    });
    if (res.status === 404) return "ok";
    if (res.status === 401) return "rejected";
    return "unknown";
  } catch {
    return "unknown";
  }
}

const validation = new Map<string, { at: number; result: "ok" | "rejected" | "unknown" }>();
async function validated(cfg: AppConfig): Promise<"ok" | "rejected" | "unknown"> {
  if (looksLikeGithubToken(cfg.clientSecret)) return "rejected";
  const key = `${cfg.clientId}:${cfg.clientSecret.slice(-6)}`;
  const hit = validation.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.result;
  const result = await validateClientPair(cfg.clientId, cfg.clientSecret);
  if (result !== "unknown") validation.set(key, { at: Date.now(), result });
  return result;
}

/** The config sign-in should use right now, plus why none is usable when that is the case. */
export async function getActiveAppConfig(): Promise<{ config: AppConfig | null; problem: ConfigProblem | null }> {
  const env = envConfig();
  if (env) {
    const v = await validated(env);
    if (v !== "rejected") return { config: env, problem: null };
  }
  let file = fileConfig();
  if (!file) {
    const remote = await storeGet<AppConfig>("app-config");
    if (remote) {
      file = remote;
      memo = remote;
      try {
        fs.mkdirSync(path.dirname(FILE()), { recursive: true });
        fs.writeFileSync(FILE(), JSON.stringify(remote, null, 2), { mode: 0o600 });
      } catch {
        // disk may be read-only; memory copy is enough for this process
      }
    }
  }
  if (file) {
    const v = await validated(file);
    if (v !== "rejected") return { config: file, problem: null };
  }
  if (env) return { config: null, problem: looksLikeGithubToken(env.clientSecret) ? "secret-is-token" : "rejected" };
  return { config: null, problem: "missing" };
}

export function saveAppConfig(cfg: AppConfig): void {
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
  memo = cfg;
  void storeSet("app-config", cfg); // survives redeploys when a durable store is configured
  // Persist for the next process on hosts with a real disk; env vars on the host still win when valid.
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (!/^GITHUB_CLIENT_ID=/m.test(existing)) {
      fs.writeFileSync(envPath, `${existing.replace(/\n+$/, "")}\n\n# GitHub App created by /setup on ${new Date().toISOString().slice(0, 10)}\nGITHUB_CLIENT_ID=${cfg.clientId}\nGITHUB_CLIENT_SECRET=${cfg.clientSecret}\n${cfg.slug ? `GITHUB_APP_SLUG=${cfg.slug}\n` : ""}`);
    }
  } catch {
    // .env.local is a convenience; the json file is the source of truth
  }
}
