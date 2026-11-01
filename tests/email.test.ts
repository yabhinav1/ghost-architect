import assert from "node:assert/strict";
import { test } from "node:test";
import { renderEmail } from "../src/lib/email-template.ts";

test("renderEmail escapes content, links the CTA and produces a text twin", () => {
  const { html, text } = renderEmail({
    appUrl: "https://ghost.test",
    kicker: "acme/pay",
    heading: "Finish <billing> migration",
    meta: "Work handoff from @alice",
    blocks: [
      { kind: "facts", rows: [{ label: "Repository", value: "acme/pay", href: "https://github.com/acme/pay" }] },
      { kind: "quote", label: "Notes", text: "Run the tests\nthen merge <main>" },
      { kind: "callout", tone: "warning", text: "Ownership moves on accept." },
      { kind: "list", title: "Next", items: ["one", "two"] },
    ],
    cta: { label: "Review", url: "https://ghost.test/me#transfer-1" },
    secondary: [{ label: "Repo", url: "https://github.com/acme/pay" }],
    reason: "You are receiving this because of a test.",
  });
  assert.ok(html.includes("Finish &lt;billing&gt; migration"), "heading escaped");
  assert.ok(!html.includes("<billing>"), "raw tag never emitted");
  assert.ok(html.includes("then merge &lt;main&gt;"), "quote escaped");
  assert.ok(html.includes('href="https://ghost.test/me#transfer-1"'), "cta link");
  assert.ok(html.includes("https://ghost.test/mail-logo.png"), "logo");
  assert.ok(html.includes("#fff8c5"), "warning callout tone");
  assert.ok(text.includes("> Run the tests"), "text twin quotes notes");
  assert.ok(text.includes("Review: https://ghost.test/me#transfer-1"), "text twin has cta");
  assert.ok(!/<[a-z]/i.test(text), "text twin has no html");
});
