import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const markdown = readFileSync(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
const source = readFileSync(new URL("../shared/scripts/message-text.js", import.meta.url), "utf8");
function setup() {
  const { document } = parseHTML("<html><body></body></html>");
  const window = { location: { origin: "https://example.test" } };
  const context = vm.createContext({ window, document, URL, Intl });
  vm.runInContext(markdown, context);
  vm.runInContext(source, context);
  const target = document.createElement("p");
  return { document, window, target, text: window.BITS_MESSAGE_TEXT };
}

test("inline message formatting is opt-in, preserving all existing literal punctuation", () => {
  const { text, target } = setup();
  const literal = "**bold** and {{color:rainbow|color}} <script>alert(1)</script>";
  text.render(target, { text: literal });
  assert.equal(target.textContent, literal);
  assert.equal(target.querySelector("strong,script,span"), null);
  text.render(target, { text: literal, markup: true });
  assert.equal(target.querySelector("strong").textContent, "bold");
  assert.equal(target.querySelector(".blog-text-color-rainbow").textContent, "color");
  assert.equal(target.querySelector("script"), null);
  assert.ok(target.textContent.includes("<script>alert(1)</script>"));
});

test("typewriter rendering compiles once, slices visible graphemes and retains nested formatting while typing and deleting", () => {
  const { window, text, target } = setup();
  let parses = 0;
  const inline = window.BITS_MARKDOWN.renderInline;
  window.BITS_MARKDOWN = { renderInline(value) { parses++; return inline(value); } };
  const option = { text: "A **bold** {{color:rainbow|👩‍💻e\u0301!}} end", markup: true };
  const prepared = text.prepare(option);
  const expected = ["A", " ", "b", "o", "l", "d", " ", "👩‍💻", "e\u0301", "!", " ", "e", "n", "d"];
  assert.deepEqual(Array.from(prepared.characters), expected);
  for (const length of [0, 1, 4, 8, 9, 10, 14, 13, 8, 4, 0]) {
    text.render(target, option, { length });
    assert.equal(target.textContent, expected.slice(0, length).join(""));
    assert.ok(!target.textContent.includes("**") && !target.textContent.includes("{{"));
  }
  text.render(target, option, { length: 4 });
  assert.equal(target.querySelector("strong").textContent, "bo");
  text.render(target, option, { length: 9 });
  assert.equal(target.querySelector(".blog-text-color-rainbow").textContent, "👩‍💻e\u0301");
  assert.equal(parses, 1);
});

test("message-only markup permits text styling but never creates raw HTML, links, images, media, or inline event handlers", () => {
  const { target, text } = setup();
  const input = '<img src=x onerror="alert(1)"> [link](javascript:alert) ![image](https://example.test/image.png) '
    + '**[nested](https://example.test)** {{color:red|<svg onload=alert(1)>}} {{font:bad|literal}}';
  text.render(target, { text: input, markup: true });
  assert.equal(target.querySelector("a,img,svg,script,iframe,video,figure"), null);
  assert.equal(target.querySelector("[onerror],[onload],[style]"), null);
  assert.ok(target.textContent.includes("[link](javascript:alert)"));
  assert.ok(target.textContent.includes("![image](https://example.test/image.png)"));
  assert.ok(target.textContent.includes("{{font:bad|literal}}"));
  assert.equal(target.querySelector(".blog-text-color-red").textContent, "<svg onload=alert(1)>");
});

test("shared rendering supports all inline styles, literal prefixes/suffixes, and optional legacy whole-message defaults", () => {
  const { target, text } = setup();
  text.render(target, { text: "**bold** *italic* ++under++ ~~strike~~ `code` {{font:serif|serif}} {{size:large|large}}", markup: true,
    colorful: true, format: { fontWeight: "700", color: "#123456" } }, { prefix: "CHAT // ", suffix: " #2" });
  for (const selector of ["strong", "em", "u", "s", "code", ".blog-text-font-serif", ".blog-text-size-large"]) {
    assert.ok(target.querySelector(selector), selector);
  }
  assert.ok(target.textContent.startsWith("CHAT // "));
  assert.ok(target.textContent.endsWith(" #2"));
  assert.ok(target.classList.contains("is-colorful-text"));
  assert.equal(target.style.fontWeight, "700");
  text.render(target, "plain");
  assert.equal(target.textContent, "plain");
  assert.equal(target.classList.contains("is-colorful-text"), false);
  assert.equal(target.style.fontWeight, "");
});

test("adding safe message-only inline rendering does not remove links or images from normal blog Markdown", () => {
  const { document, window } = setup();
  const root = document.createElement("div");
  root.append(window.BITS_MARKDOWN.render("[Blog link](https://example.test) ![Blog image](https://example.test/image.png)"));
  assert.ok(root.querySelector("a"));
  assert.ok(root.querySelector("img"));
});
