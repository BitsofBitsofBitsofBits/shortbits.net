import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import vm from "node:vm";
import toc from "../shared/scripts/blog-toc.js";
import { markdownRenderer, renderArticle } from "./build-content.mjs";

const markdown = await readFile(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
const rich = await readFile(new URL("../shared/scripts/blog-content.js", import.meta.url), "utf8");
const renderer = markdownRenderer(markdown, rich);
const post = {
  slug: "contents-fixture", title: "Article title excluded", excerpt: "Synthetic fixture",
  published_at: "2026-11-01T00:00:00Z", body_markdown: "",
};
const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;

test("nested bullets follow heading hierarchy without inventing skipped-level headings", () => {
  const document = documentFor('<div id="body"><h2>Overview</h2><h4>Deep</h4><h5>Deeper</h5><h3>Sibling</h3><h2>Next</h2><p>No heading</p></div>');
  const details = toc.render(document.querySelector("#body"), document);
  assert.equal(details.hasAttribute("open"), false);
  assert.equal(details.querySelector("summary").textContent, "Table of Contents");
  const list = details.querySelector("nav > ul");
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].querySelector("ul").children.length, 2);
  assert.equal(list.children[0].querySelector("ul").children[0].querySelector("ul").querySelector("a").textContent, "Deeper");
  assert.deepEqual([...details.querySelectorAll("a")].map(link => link.textContent), ["Overview", "Deep", "Deeper", "Sibling", "Next"]);
});

test("anchors are deterministic, unique for colliding headings, and use safe plain heading text", () => {
  const document = documentFor('<div id="body"><h1>Same</h1><h2>Same</h2><h3>Same 2</h3><h4>Caf&eacute; &amp; <em>tea</em></h4><h5>&lt;script&gt;literal&lt;/script&gt;</h5><h6>!!!</h6></div>');
  const body = document.querySelector("#body");
  const first = toc.render(body, document);
  const ids = [...body.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(node => node.id);
  assert.deepEqual(ids, ["blog-heading-same", "blog-heading-same-2", "blog-heading-same-2-2", "blog-heading-cafe-tea", "blog-heading-script-literal-script", "blog-heading-section"]);
  assert.equal(first.querySelector("script"), null);
  assert.equal(first.querySelector("em"), null);
  assert.equal(toc.render(body, document).outerHTML, first.outerHTML);
  for (const link of first.querySelectorAll("a")) {
    const heading = document.getElementById(link.getAttribute("href").slice(1));
    assert.ok(heading);
    assert.equal(heading.getAttribute("tabindex"), "-1");
  }
  assert.equal(toc.render(documentFor("<div><p>No headings</p></div>").querySelector("div"), document), null);
});

test("generated and live Markdown/rich articles share section IDs and navigation, excluding retained source and article UI", () => {
  for (const fixture of [
    { ...post, body_markdown: "# Overview\n\n## Details\n\n## Details\n\n### Deep" },
    { ...post, body_markdown: "# Retained old source", body_rich: { version: 1, doc: { type: "doc", content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Overview" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Details" }] },
      { type: "legacyMarkdown", attrs: { source: "## Details\n\n### Deep" } },
    ] } } },
  ]) {
    const generated = documentFor(renderArticle(fixture, renderer));
    const liveDocument = documentFor("");
    const context = vm.createContext({ window: { location: { origin: "https://www.shortbits.net" } }, document: liveDocument, URL });
    vm.runInContext(markdown, context);
    vm.runInContext(rich, context);
    const body = context.window.BITS_BLOG_CONTENT.renderPost(fixture);
    const liveToc = toc.render(body, liveDocument);
    const expected = [...liveToc.querySelectorAll("a")].map(link => [link.textContent, link.getAttribute("href")]);
    assert.deepEqual([...generated.querySelectorAll("#blog-post-toc a")].map(link => [link.textContent, link.getAttribute("href")]), expected);
    assert.deepEqual(expected.map(([label]) => label), ["Overview", "Details", "Details", "Deep"]);
    assert.equal(generated.querySelector("#blog-post-toc details").hasAttribute("open"), false);
    for (const [, href] of expected) assert.ok(generated.getElementById(href.slice(1)));
    assert.match(renderArticle(fixture, renderer), /blog\/styles\/article-toc\.css/);
  }
  assert.equal(documentFor(renderArticle({ ...post, body_markdown: "Just a paragraph" }, renderer)).querySelector("#blog-post-toc details"), null);
});
