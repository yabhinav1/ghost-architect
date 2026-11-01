/**
 * GitHub-notification-style transactional email. Table layout and inline styles only, so Gmail,
 * Outlook and Apple Mail all render it the same. Every email also gets a plain-text twin.
 */
export type EmailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string; label?: string; /** author-supplied text: URLs stay plain so the host never vouches for them */ untrusted?: boolean }
  | { kind: "facts"; rows: { label: string; value: string; href?: string }[] }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "callout"; text: string; tone?: "info" | "warning" | "success" };

export type EmailSpec = {
  /** hidden preview text shown by inbox clients next to the subject */
  preheader?: string;
  /** small line above the heading, e.g. the organisation or repository */
  kicker?: string;
  heading: string;
  /** "@alice · Acme Payments · 1 Nov" style meta line under the heading */
  meta?: string;
  blocks: EmailBlock[];
  cta?: { label: string; url: string };
  secondary?: { label: string; url: string }[];
  /** "You are receiving this because…" */
  reason: string;
  appUrl: string;
};

const C = { text: "#1f2328", muted: "#59636e", subtle: "#8c959f", border: "#d1d9e0", bg: "#f6f8fa", link: "#0969da", green: "#1f883d", warnBg: "#fff8c5", warnBorder: "#d4a72c", infoBg: "#ddf4ff", infoBorder: "#54aeff", okBg: "#dafbe1", okBorder: "#4ac26b" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'";

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
const nl = (s: string) => esc(s).replace(/\n/g, "<br>");
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${C.link};text-decoration:none">$1</a>`);

function block(b: EmailBlock): string {
  switch (b.kind) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${C.text}">${linkify(nl(b.text))}</p>`;
    case "quote":
      return `${b.label ? `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:.04em">${esc(b.label)}</p>` : ""}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px"><tr><td style="border-left:4px solid ${C.border};padding:4px 0 4px 14px;font-size:14px;line-height:1.6;color:${C.text}">${b.untrusted ? nl(b.text) : linkify(nl(b.text))}</td></tr></table>`;
    case "facts":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid ${C.border};border-radius:6px;border-collapse:separate;overflow:hidden">${b.rows.map((r, i) => `<tr><td style="padding:8px 12px;font-size:12px;color:${C.muted};width:38%;background:${C.bg};border-top:${i ? `1px solid ${C.border}` : "0"}">${esc(r.label)}</td><td style="padding:8px 12px;font-size:13px;color:${C.text};border-top:${i ? `1px solid ${C.border}` : "0"};word-break:break-word">${r.href ? `<a href="${esc(r.href)}" style="color:${C.link};text-decoration:none">${esc(r.value)}</a>` : esc(r.value)}</td></tr>`).join("")}</table>`;
    case "list":
      return `${b.title ? `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:${C.text}">${esc(b.title)}</p>` : ""}<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.6;color:${C.text}">${b.items.map((i) => `<li style="margin:0 0 4px">${linkify(nl(i))}</li>`).join("")}</ul>`;
    case "callout": {
      const [bg, bd] = b.tone === "warning" ? [C.warnBg, C.warnBorder] : b.tone === "success" ? [C.okBg, C.okBorder] : [C.infoBg, C.infoBorder];
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px"><tr><td style="background:${bg};border:1px solid ${bd};border-radius:6px;padding:10px 12px;font-size:13px;line-height:1.5;color:${C.text}">${linkify(nl(b.text))}</td></tr></table>`;
    }
  }
}

export function renderEmail(spec: EmailSpec): { html: string; text: string } {
  const logo = `${spec.appUrl}/mail-logo.png`;
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(spec.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
${spec.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(spec.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;font-family:${FONT}">
  <tr><td style="padding:0 0 20px">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="vertical-align:middle;padding-right:10px"><img src="${logo}" width="32" height="32" alt="" style="display:block;border-radius:7px"></td>
      <td style="vertical-align:middle;font-size:16px;font-weight:600;color:${C.text}">Ghost-Architect</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;border:1px solid ${C.border};border-radius:8px;padding:28px 32px">
    ${spec.kicker ? `<p style="margin:0 0 6px;font-size:12px;color:${C.muted};font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${esc(spec.kicker)}</p>` : ""}
    <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:600;color:${C.text}">${esc(spec.heading)}</h1>
    ${spec.meta ? `<p style="margin:0 0 20px;font-size:13px;color:${C.muted}">${esc(spec.meta)}</p>` : `<div style="height:14px"></div>`}
    ${spec.blocks.map(block).join("")}
    ${spec.cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 8px"><tr><td style="background:${C.green};border-radius:6px"><a href="${esc(spec.cta.url)}" style="display:inline-block;padding:9px 18px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${esc(spec.cta.label)}</a></td></tr></table>` : ""}
    ${spec.secondary?.length ? `<p style="margin:8px 0 0;font-size:13px">${spec.secondary.map((l) => `<a href="${esc(l.url)}" style="color:${C.link};text-decoration:none">${esc(l.label)}</a>`).join(`<span style="color:${C.subtle}"> &middot; </span>`)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${C.subtle}">
    ${esc(spec.reason)}<br>
    <a href="${esc(spec.appUrl)}/me" style="color:${C.subtle}">Open your inbox</a> &middot; <a href="${esc(spec.appUrl)}" style="color:${C.subtle}">Ghost-Architect</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const lines: string[] = [];
  if (spec.kicker) lines.push(spec.kicker);
  lines.push(spec.heading, spec.meta ?? "", "");
  for (const b of spec.blocks) {
    if (b.kind === "paragraph") lines.push(b.text, "");
    else if (b.kind === "quote") lines.push(...(b.label ? [b.label.toUpperCase()] : []), ...b.text.split("\n").map((l) => `> ${l}`), "");
    else if (b.kind === "facts") lines.push(...b.rows.map((r) => `${r.label}: ${r.value}${r.href ? ` (${r.href})` : ""}`), "");
    else if (b.kind === "list") lines.push(...(b.title ? [b.title] : []), ...b.items.map((i) => `- ${i}`), "");
    else lines.push(b.text, "");
  }
  if (spec.cta) lines.push(`${spec.cta.label}: ${spec.cta.url}`, "");
  for (const l of spec.secondary ?? []) lines.push(`${l.label}: ${l.url}`);
  lines.push("", spec.reason, `${spec.appUrl}/me`);
  return { html, text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}
