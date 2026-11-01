import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

/**
 * Outbound email. Configured with SMTP_* (Gmail works with an app password); when unset, every message
 * is written to .cache/outbox so the demo still shows what would have gone out. Never throws: callers
 * treat delivery as best effort and the in-app inbox remains the source of truth.
 */
export type Mail = { to: string; subject: string; text: string; html?: string };
export type MailResult = { sent: boolean; via: "smtp" | "brevo" | "outbox"; error?: string };

export function mailConfig() {
  const user = process.env.SMTP_USER?.trim();
  // Google shows app passwords as four groups with spaces; people paste them that way.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  // Brevo (free tier, HTTPS) for hosts that block outbound SMTP ports, such as Render's free plan.
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim() || (user ? `Ghost-Architect <${user}>` : "");
  const provider: "brevo" | "smtp" | "none" = brevoKey && from ? "brevo" : user && pass ? "smtp" : "none";
  return { configured: provider !== "none", provider, brevoKey, user, pass, host, port, from };
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  return m ? { name: (m[1] ?? "").trim() || "Ghost-Architect", email: m[2].trim() } : { name: "Ghost-Architect", email: from.trim() };
}

async function sendBrevo(m: Mail, key: string, from: string): Promise<MailResult> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: parseFrom(from), to: [{ email: m.to }], subject: m.subject, textContent: m.text, htmlContent: m.html ?? toHtml(m.text) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 201 || res.status === 202) return { sent: true, via: "brevo" };
  const detail = await res.json().catch(() => ({})) as { message?: string; code?: string };
  return { sent: false, via: "brevo", error: `Brevo ${res.status}${detail.message ? `: ${detail.message}` : ""}` };
}

const NOREPLY = /@users\.noreply\.github\.com$/i;
/** A deliverable address: well-formed and not GitHub's privacy relay. */
export function deliverable(email: string | undefined | null): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !NOREPLY.test(email));
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

let transport: nodemailer.Transporter | null = null;
function smtp() {
  const c = mailConfig();
  if (c.provider !== "smtp") return null;
  transport ??= nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 });
  return transport;
}

let verified: { at: number; ok: boolean; error?: string } | null = null;
/** Logs in to the SMTP server without sending anything. Cached for five minutes. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const c = mailConfig();
  if (c.provider === "none") return { ok: false, error: "No email provider configured" };
  // A good result is cached for five minutes; a failure only for thirty seconds so a network blip does not stick.
  if (verified && Date.now() - verified.at < (verified.ok ? 300_000 : 30_000)) return verified;
  try {
    if (c.provider === "brevo") {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 2 && !res; attempt++) {
        try {
          res = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": c.brevoKey!, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
        } catch (e) {
          if (attempt === 1) throw new Error(`Brevo could not be reached: ${(e as Error).message}`);
        }
      }
      if (!res!.ok) throw new Error(`Brevo rejected the API key (${res!.status})`);
      verified = { at: Date.now(), ok: true };
    } else {
      await smtp()!.verify();
      verified = { at: Date.now(), ok: true };
    }
  } catch (e) {
    verified = { at: Date.now(), ok: false, error: (e as Error).message };
  }
  return verified;
}

export async function sendMail(m: Mail): Promise<MailResult> {
  const r = await deliver(m);
  console.log(`[mail] ${m.to} "${m.subject.slice(0, 60)}" -> ${r.sent ? "sent" : r.via}${r.error ? ` (${r.error})` : ""}`);
  return r;
}

async function deliver(m: Mail): Promise<MailResult> {
  if (!deliverable(m.to)) return { sent: false, via: "outbox", error: "no deliverable address" };
  const c = mailConfig();
  if (c.provider === "brevo") {
    let last = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await sendBrevo(m, c.brevoKey!, c.from);
      } catch (e) {
        last = (e as Error).message;
      }
    }
    return { sent: false, via: "brevo", error: `Brevo could not be reached: ${last}` };
  }
  const t = smtp();
  if (t) {
    try {
      await t.sendMail({ from: c.from, to: m.to, subject: m.subject, text: m.text, html: m.html ?? toHtml(m.text) });
      return { sent: true, via: "smtp" };
    } catch (e) {
      console.warn(`[mail] ${m.to}: ${(e as Error).message}`);
      return { sent: false, via: "smtp", error: (e as Error).message };
    }
  }
  try {
    const dir = path.join(process.cwd(), ".cache", "outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}-${m.to.replace(/[^\w.@-]/g, "_")}.json`), JSON.stringify({ ...m, at: new Date().toISOString() }, null, 2));
  } catch (e) {
    return { sent: false, via: "outbox", error: `outbox write failed: ${(e as Error).message}` };
  }
  return { sent: false, via: "outbox", error: "SMTP not configured" };
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Plain text to a tidy HTML email: paragraphs, and bare URLs become links. */
export function toHtml(text: string): string {
  const body = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0969da">$1</a>')}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f8fa;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2328;font-size:15px;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d1d9e0;border-radius:8px;padding:28px"><p style="margin:0 0 16px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#59636e">Ghost-Architect</p>${body}<p style="margin:16px 0 0;font-size:12px;color:#8c959f">Sent by Ghost-Architect. Sign in with GitHub to act on this message.</p></div></body></html>`;
}
