import { renderEmail } from "@/lib/email-template";
import { appUrl, mailConfig, sendMail, verifySmtp } from "@/lib/mail";
import { isAdmin } from "@/lib/roles";
import { getSession } from "@/lib/session";

/** Admin-only: send a test email so a deployment's SMTP can be proven end to end. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdmin(session.login)) return Response.json({ error: "Admins only" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { to?: string };
  const to = (body.to ?? mailConfig().user ?? "").trim();
  if (!to) return Response.json({ error: "Provide a recipient address" }, { status: 400 });
  const verify = await verifySmtp();
  const email = renderEmail({
    appUrl: appUrl(),
    preheader: "Email delivery is working.",
    kicker: appUrl().replace(/^https?:\/\//, ""),
    heading: "Test email",
    meta: `Sent by @${session.login} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    blocks: [
      { kind: "callout", tone: "success", text: "If you can read this, outbound email from this deployment works." },
      { kind: "facts", rows: [{ label: "Provider", value: mailConfig().provider }, { label: "From", value: mailConfig().from }] },
    ],
    cta: { label: "Open the admin page", url: `${appUrl()}/admin` },
    reason: "You are receiving this because an administrator sent a test from Ghost-Architect.",
  });
  const result = await sendMail({ to, subject: "Ghost-Architect test email", ...email });
  return Response.json({ to, verify, result });
}
