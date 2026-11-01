import { mailConfig, sendMail, verifySmtp } from "@/lib/mail";
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
  const result = await sendMail({ to, subject: "Ghost-Architect test email", text: `This is a test from ${process.env.APP_URL ?? "Ghost-Architect"} sent at ${new Date().toISOString()} by @${session.login}.\n\nIf you can read this, SMTP delivery works.` });
  return Response.json({ to, verify, result });
}
