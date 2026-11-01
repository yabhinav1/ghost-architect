import { getAppConfig, validateClientPair } from "@/lib/app-config";
import { looksLikeGithubToken, serverGithubToken } from "@/lib/env";
import { llmConfig } from "@/lib/llm";
import { mailConfig, verifySmtp } from "@/lib/mail";
import { storeEnabled } from "@/lib/store";

/**
 * Deployment self-check, safe to expose: reports whether each credential works, never the values.
 *   oauth: validates client id + secret against GitHub's applications endpoint
 *   githubToken: validates GITHUB_TOKEN and reports the API quota it gives the server
 */
export async function GET() {
  const out: Record<string, unknown> = { ok: true, checkedAt: new Date().toISOString() };
  const hasSessionSecret = Boolean(process.env.AUTH_SECRET?.trim() || process.env.GITHUB_CLIENT_SECRET?.trim());
  out.session = { status: hasSessionSecret ? "configured" : process.env.NODE_ENV === "development" ? "temporary" : "missing", hint: hasSessionSecret ? undefined : "Set AUTH_SECRET to a long random value before enabling production sign-in." };
  if (!hasSessionSecret && process.env.NODE_ENV !== "development") out.ok = false;

  const cfg = getAppConfig();
  if (!cfg) out.oauth = { status: "missing", hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or run /setup." };
  else {
    const secretIsToken = looksLikeGithubToken(cfg.clientSecret);
    const v = secretIsToken ? "rejected" : await validateClientPair(cfg.clientId, cfg.clientSecret);
    out.oauth = {
      status: v === "ok" ? "ok" : v === "rejected" ? "incorrect" : "unknown",
      clientId: cfg.clientId,
      kind: cfg.kind,
      secretLength: cfg.clientSecret.length,
      hint: v === "ok" ? undefined : secretIsToken ? "GITHUB_CLIENT_SECRET contains a personal access token. Put the PAT in GITHUB_TOKEN and the OAuth App's client secret here." : v === "rejected" ? "GitHub rejects this client id + secret pair. Regenerate the secret on the OAuth App page and paste it into GITHUB_CLIENT_SECRET." : "GitHub could not be reached to validate the pair.",
    };
    if (v === "rejected") out.ok = false;
  }

  const token = serverGithubToken();
  if (!token) out.githubToken = { status: "missing", hint: "Set GITHUB_TOKEN to a fine-grained PAT with public read access so the server has its own API quota." };
  else {
    try {
      const res = await fetch("https://api.github.com/rate_limit", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ghost-architect" } });
      if (res.ok) {
        const j = (await res.json()) as { resources?: { core?: { limit: number; remaining: number } } };
        out.githubToken = { status: "ok", limitPerHour: j.resources?.core?.limit, remaining: j.resources?.core?.remaining, source: process.env.GITHUB_TOKEN ? "GITHUB_TOKEN" : "GITHUB_CLIENT_SECRET (misplaced PAT, used for API quota only)" };
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
  const mail = mailConfig();
  if (mail.configured) {
    const v = await verifySmtp();
    const hint = v.ok ? undefined
      : mail.provider === "brevo" ? (/reached|fetch failed|timeout/i.test(v.error ?? "") ? "Brevo's API could not be reached from this host just now; this is a network blip and retries itself within 30 seconds." : "Check BREVO_API_KEY and that MAIL_FROM uses a sender verified in Brevo.")
      : /auth|credentials|535/i.test(v.error ?? "") ? "Gmail rejected the login. Use a 16-character app password (not the account password) from myaccount.google.com/apppasswords, with SMTP_USER set to the same Gmail address."
      : "The SMTP port is blocked or unreachable from this host. Try SMTP_PORT=587; if that also times out the host blocks SMTP, so use Brevo over HTTPS: set BREVO_API_KEY and MAIL_FROM to a sender verified in Brevo.";
    out.mail = { status: v.ok ? mail.provider : `${mail.provider}-failing`, provider: mail.provider, host: mail.provider === "smtp" ? mail.host : undefined, port: mail.provider === "smtp" ? mail.port : undefined, from: mail.from, error: v.error, hint };
  } else out.mail = { status: "outbox", hint: "Set BREVO_API_KEY + MAIL_FROM (HTTPS, works on hosts that block SMTP) or SMTP_USER + SMTP_PASS (Gmail app password) to deliver notices and handoffs by email; until then they are written to .cache/outbox and delivered in-app only." };
  out.appUrl = process.env.APP_URL ?? null;

  return Response.json(out, { status: out.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
