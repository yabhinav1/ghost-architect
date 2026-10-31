import { inboxOf } from "./org.ts";
import { transfersFor } from "./work-transfers.ts";
import type { InboxSummary } from "./types.ts";

export async function inboxSummary(actor: { login: string; token: string }): Promise<InboxSummary> {
  const [notices, work] = await Promise.all([inboxOf(actor.login), transfersFor(actor)]);
  const items = [
    ...notices.map((n) => ({ id: n.id, title: n.subject, detail: `Notice from ${n.orgName}`, href: `/me#notice-${n.id}`, unread: n.status === "sent", at: n.createdAt })),
    ...work.transfers.map((t) => ({ id: t.id, title: t.title, detail: `${t.incoming ? `From @${t.senderLogin}` : `To ${t.recipientEmail}`} · ${t.status}`, href: `/me#transfer-${t.id}`, unread: t.incoming ? !t.recipientReadAt : !t.senderReadAt, at: t.updatedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { ...work, notices, items, unread: items.filter((i) => i.unread).length };
}
