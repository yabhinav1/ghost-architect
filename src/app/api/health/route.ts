import { getAppConfig } from "@/lib/app-config";
import { llmConfig } from "@/lib/llm";
import { storeEnabled } from "@/lib/store";

/**
 * Deployment self-check, safe to expose: reports whether each credential works, never the values.
 *   oauth: validates client id + secret against GitHub's applications endpoint
 *   githubToken: validates GITHUB_TOKEN and reports the API quota it gives the server
 */
export async function GET() {
  const out: Record<string, unknown> = { ok: true, checkedAt: new Date().toISOString() };

  const cfg = getAppConfig();
  if (!cfg) out.oauth = { status: "missing", hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or run /setup." };
  else {
    const looksLikePat = /^(github_pat_|ghp_|gho_)/.test(cfg.clientSecret);
    try {
      // 404 = credentials accepted but that token does not exist (expected); 401 = bad client id or secret.
      const res = await fetch(`https://api.github.com/applications/${cfg.clientId}/token`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64"), Accept: "application/vnd.github+json", "User-Agent": "ghost-architect", "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "ghost-architect-health-check" }),
      });
      const valid = res.status === 404;
      out.oauth = {
        status: valid ? "ok" : "incorrect",
        clientId: cfg.clientId,
        kind: cfg.kind,
        secretLength: cfg.clientSecret.length,
        hint: valid ? undefined : looksLikePat ? "GITHUB_CLIENT_SECRET contains a personal access token. Put the PAT in GITHUB_TOKEN and the OAuth App's client secret here." : "GitHub rejects this client id + secret pair. Regenerate the secret on the OAuth App page and paste it into GITHUB_CLIENT_SECRET.",
      };
      if (!valid) out.ok = false;
    } catch (e) {
      out.oauth = { status: "unknown", error: (e as Error).message };
    }
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) out.githubToken = { status: "missing", hint: "Set GITHUB_TOKEN to a fine-grained PAT with public read access so the server has its own API quota." };
  else {
    try {
      const res = await fetch("https://api.github.com/rate_limit", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" } });
      if (res.ok) {
        const j = (await res.json()) as { resources?: { core?: { limit: number; remaining: number } } };
        out.githubToken = { status: "ok", limitPerHour: j.resources?.core?.limit, remaining: j.resources?.core?.remaining };
      } else {
        out.githubToken = { status: "invalid", httpStatus: res.status };
        out.ok = false;
      }
    } catch (e) {
      out.githubToken = { status: "unknown", error: (e as Error).message };
    }
  }

  const llm = llmConfig();
  out.llm = { status: llm.apiKey ? "configured" : "missing", baseUrl: llm.baseUrl, model: llm.model };
  if (!llm.apiKey) out.ok = false;
  out.durableStore = storeEnabled ? "on" : "off";
  out.appUrl = process.env.APP_URL ?? null;

  return Response.json(out, { status: out.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
