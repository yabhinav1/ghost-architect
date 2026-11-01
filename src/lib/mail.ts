import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

/**
 * Outbound email. Configured with SMTP_* (Gmail works with an app password); when unset, every message
 * is written to .cache/outbox so the demo still shows what would have gone out. Never throws: callers
 * treat delivery as best effort and the in-app inbox remains the source of truth.
 */
export type Mail = { to: string; subject: string; text: string; html?: string };
export type MailResult = { sent: boolean; via: "smtp" | "outbox"; error?: string };

export function mailConfig() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.MAIL_FROM?.trim() || (user ? `Ghost-Architect <${user}>` : "");
  return { configured: Boolean(user && pass), user, pass, host, port, from };
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
  if (!c.configured) return null;
  transport ??= nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
  return transport;
}

export async function sendMail(m: Mail): Promise<MailResult> {
  if (!deliverable(m.to)) return { sent: false, via: "outbox", error: "no deliverable address" };
  const c = mailConfig();
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
  } catch { /* outbox is a courtesy */ }
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
