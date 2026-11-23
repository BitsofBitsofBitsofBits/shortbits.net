import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { markdownRenderer } from "./build-content.mjs";
const markdown = await readFile(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
const source = await readFile(new URL("../shared/scripts/blog-content.js", import.meta.url), "utf8");
const { window, document } = parseHTML("<html><body></body></html>");
const context = vm.createContext({ window, document, URL });
vm.runInContext(markdown, context);
vm.runInContext(source, context);
const api = window.BITS_BLOG_CONTENT;
const envelope = content => ({ version: 1, doc: { type: "doc", content } });
const text = (value, marks = []) => ({ type: "text", text: value, marks });
test("strict structured documents reject unsafe URLs, unknown nodes, malformed nesting and style injections", () => {
  for (const value of [
    { version: 2, doc: { type: "doc", content: [] } },
    envelope([{ type: "html", attrs: { html: "<script>" } }]),
    envelope([{ type: "listItem", content: [{ type: "paragraph" }] }]),
    envelope([{ type: "paragraph", content: [text("unsafe", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])] }]),
    envelope([{ type: "paragraph", content: [text("unsafe", [{ type: "style", attrs: { color: "#aaaaa" } }])] }]),
    envelope([{ type: "codeBlock", content: [text("code", [{ type: "bold" }])] }]),
    envelope([{ type: "image", attrs: { src: "https://example.test/image", alt: "", caption: "" } }]),
    envelope([{ type: "paragraph", attrs: { onclick: "alert(1)" } }]),
  ]) assert.throws(() => api.validate(value));
});
test("rich rendering preserves protected source, accessible images, tasks, tables and safe styles in live and static HTML", () => {
  const value = envelope([
    { type: "paragraph", content: [text("<script>literal</script>", [{ type: "bold" }, { type: "style", attrs: { color: "#abc", font: "serif", size: "large" } }])] },
    { type: "image", attrs: { src: "https://example.test/image.png", alt: "Alt", caption: "Caption" } },
    { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [text("Complete")] }] }] },
    { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2, rowspan: 1, colwidth: null }, content: [{ type: "paragraph", content: [text("Header")] }] }] }] },
    { type: "legacyMarkdown", attrs: { source: "{{font:custom:Arial|**original**}}\n\n<script>literal</script>" } },
  ]);
  const body = document.createElement("div"); body.append(api.render(value));
  const staticHTML = markdownRenderer(markdown, source).renderPost({ body_markdown: "", body_rich: value });
  for (const html of [body.innerHTML, staticHTML]) {
    assert.match(html, /<strong>/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
    assert.match(html, /figcaption>Caption/); assert.match(html, /alt="Alt"/);
    assert.match(html, /colspan="2"/); assert.match(html, /Scrollable table/); assert.match(html, /disabled/);
    assert.match(html, /original/); assert.match(html, /font-family/);
  }
  assert.match(api.text(value), /Complete/);
});
test("legacy-only posts use exactly the existing renderer and rich content takes precedence without overwriting source", () => {
  const legacy = "Original **Markdown**";
  const body = document.createElement("div"); body.append(api.renderPost({ body_markdown: legacy }));
  const original = document.createElement("div"); original.append(window.BITS_MARKDOWN.render(legacy));
  assert.equal(body.innerHTML, original.innerHTML);
  const rich = envelope([{ type: "paragraph", content: [text("New text")] }]);
  assert.equal(api.text(rich), "New text");
  assert.doesNotMatch(markdownRenderer(markdown, source).renderPost({ body_markdown: legacy, body_rich: rich }), /Original/);
});
test("formatted line breaks survive structured editing and both public renderers", () => {
  const rich = envelope([{ type: "paragraph", content: [text("First", [{ type: "bold" }]), { type: "hardBreak", marks: [{ type: "bold" }] }, text("Second", [{ type: "bold" }])] }]);
  assert.match(markdownRenderer(markdown, source).renderPost({ body_markdown: "", body_rich: rich }), /<strong><br><\/strong>/);
});
test("editor link titles accept nullable defaults and render safely in live and static articles", () => {
  for (const title of [null, 'Read "this" <safely>']) {
    const rich = envelope([{ type: "paragraph", content: [text("Shown", [{ type: "link", attrs: {
      href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow", class: null, title,
    } }])] }]);
    const body = document.createElement("div"); body.append(api.render(rich));
    const staticHTML = markdownRenderer(markdown, source).renderPost({ body_markdown: "", body_rich: rich });
    for (const html of [body.innerHTML, staticHTML]) {
      const parsed = parseHTML(`<html><body>${html}</body></html>`).document;
      assert.equal(parsed.querySelector("a").getAttribute("title"), title);
      assert.equal(parsed.querySelector("a").textContent, "Shown");
      assert.equal(parsed.querySelector("safely"), null);
    }
  }
  for (const title of [42, {}, "x".repeat(2001)]) assert.throws(() => api.validate(envelope([
    { type: "paragraph", content: [text("Shown", [{ type: "link", attrs: { href: "https://example.com", title } }])] },
  ])), /Invalid link title/);
});
