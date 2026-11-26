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
test("reader-only color backings meet normal-text AA without changing stored hex, alpha or import colors", () => {
  const luminance = channels => channels.map(channel => channel / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  for (const original of ["#553fff", "#fff0", "#0002", "#ff000020", "#abc8", "#777"]) {
    const presentation = window.BITS_MARKDOWN.readableHexColor(original);
    let digits = presentation.color.slice(1);
    if (digits.length <= 4) digits = [...digits].map(digit => digit.repeat(2)).join("");
    const rgb = digits.slice(0, 6).match(/../g).map(channel => parseInt(channel, 16));
    const alpha = digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1;
    const back = presentation.background === "#ffffff" ? 255 : 0;
    const light = luminance(rgb.map(channel => channel * alpha + back * (1 - alpha)));
    assert.ok((back ? 1.05 / (light + .05) : (light + .05) / .05) >= 4.5, original);
    assert.equal(presentation.original, original);
    if (original === "#553fff") assert.equal(presentation.color, original, "Opaque author hue stays exact");
    const value = envelope([{ type: "paragraph", content: [text("Colored", [{ type: "style", attrs: { color: original } }])] }]);
    const saved = JSON.stringify(value);
    const rich = document.createElement("div");
    rich.append(api.render(value, { readableColors: true }));
    const md = document.createElement("div");
    md.append(window.BITS_MARKDOWN.render(`{{color:${original}|Colored}}`, { readableColors: true }));
    for (const body of [rich, md]) {
      assert.equal(body.querySelector(".blog-color-readable").dataset.color, original);
      assert.equal(body.querySelector(".blog-color-readable").style.color, presentation.color);
    }
    const imported = document.createElement("div");
    imported.append(api.render(value));
    assert.equal(imported.querySelector("span").style.color, original, "Editorial/import rendering retains alpha");
    assert.equal(JSON.stringify(value), saved);
  }
});

test("reader color presentation covers headings, quotes, lists, tables, protected Markdown and nested rainbow", () => {
  const mdSource = "# {{color:#553fff|Heading}}\n\n> {{color:#553fff|Quote}}\n\n- {{color:#553fff|List}}\n\n{{color:rainbow|**Rainbow**}}";
  const body = document.createElement("div");
  body.append(window.BITS_MARKDOWN.render(mdSource, { readableColors: true }));
  assert.equal(body.querySelectorAll(".blog-color-readable").length, 3);
  assert.equal(body.querySelector(".blog-rainbow-surface .blog-text-color-rainbow strong").textContent, "Rainbow");
  const rich = document.createElement("div");
  rich.append(api.render(envelope([{ type: "legacyMarkdown", attrs: { source: mdSource } }]), { readableColors: true }));
  assert.equal(rich.innerHTML, body.innerHTML);
  const staticBody = parseHTML(markdownRenderer(markdown, source).renderPost({ body_markdown: mdSource })).document;
  assert.equal(staticBody.querySelectorAll(".blog-color-readable").length, 3);
  const table = api.render(envelope([{ type: "table", content: [{ type: "tableRow", content: [{
    type: "tableCell", content: [{ type: "paragraph", content: [text("Cell", [{ type: "style", attrs: { color: "#553fff" } }])] }],
  }] }] }]), { readableColors: true });
  assert.equal(table.querySelector("td .blog-color-readable").dataset.color, "#553fff");
});

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
