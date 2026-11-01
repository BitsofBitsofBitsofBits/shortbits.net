import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const markdownSource = await readFile(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
const pasteSource = await readFile(new URL("../admin/scripts/blog-paste.js", import.meta.url), "utf8");
function editor() {
  const { document } = parseHTML("<html><body></body></html>");
  const window = { location: { origin: "https://www.shortbits.net" } };
  const context = vm.createContext({ document, window, URL });
  vm.runInContext(markdownSource, context);
  vm.runInContext(pasteSource, context);
  return {
    convert: window.BITS_BLOG_PASTE.fromHtml,
    render(markdown) {
      const container = document.createElement("div");
      container.append(window.BITS_MARKDOWN.render(markdown));
      return container;
    },
  };
}

test("semantic and inline CSS clipboard formatting round trips through the real renderer", () => {
  const { convert, render } = editor();
  const markdown = convert('<h2>Heading</h2><p><b>Bold <i>both</i></b> <u>under</u> <s>strike</s> <mark>highlight</mark><br>Next</p><p><span style="font-weight:700;font-style:italic;color:rgb(85, 57, 204)">Styled</span></p>');
  const dom = render(markdown);
  assert.equal(dom.querySelector("h3").textContent, "Heading");
  assert.equal(dom.querySelector("strong em").textContent, "both");
  assert.equal(dom.querySelector("u").textContent, "under");
  assert.equal(dom.querySelector("s").textContent, "strike");
  assert.equal(dom.querySelector("mark").textContent, "highlight");
  assert.equal(dom.querySelectorAll("br").length, 1);
  assert.equal(dom.querySelector(".blog-text-color-custom strong em").textContent, "Styled");
  assert.match(markdown, /\{\{color:#5539cc\|/);
});

test("Google Docs normal-weight wrappers do not make every word bold and child resets work", () => {
  const { convert, render } = editor();
  const dom = render(convert('<b style="font-weight:normal"><span style="font-weight:700">Bold</span> plain</b><p style="font-weight:bold">Parent <span style="font-weight:400">reset</span></p>'));
  assert.equal(dom.querySelector("strong").textContent, "Bold");
  assert.ok(dom.textContent.includes("plain"));
  assert.equal(Array.from(dom.querySelectorAll("strong")).some(node => node.textContent.includes("reset")), false);
});

test("headings, paragraphs, lists, tables, links, and code use supported Markdown", () => {
  const { convert, render } = editor();
  const markdown = convert('<p>First</p><p>Second</p><ul><li>One</li><li>Two</li></ul><ol><li>Three</li></ol><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><p><a href="/blog/">Blog</a> <code>x &lt; y</code></p><pre>  indented\n&lt;br&gt;</pre>');
  const dom = render(markdown);
  assert.equal(dom.querySelectorAll("ul li").length, 2);
  assert.equal(dom.querySelectorAll("ol li").length, 1);
  assert.equal(dom.querySelector("td").textContent, "1");
  assert.equal(dom.querySelector("a").getAttribute("href"), "https://www.shortbits.net/blog/");
  assert.equal(dom.querySelector("pre code").textContent, "  indented\n<br>");
  assert.equal(dom.querySelector("pre br"), null);
  assert.match(markdown, /First\n\nSecond/);
});

test("clipboard scripts, active content, unsafe destinations and hidden text are not imported", () => {
  const { convert, render } = editor();
  const markdown = convert('<script>alert(1)</script><style>body{color:red}</style><iframe src="https://evil.test">frame</iframe><p onclick="alert(1)"><a href="javascript:alert(1)">Label</a><img src="https://evil.test/pixel"><span hidden>hidden</span><span style="display:none">secret</span>Visible</p>');
  assert.equal(markdown, "LabelVisible");
  assert.equal(render(markdown).querySelector("a"), null);
  assert.doesNotMatch(markdown, /script|iframe|onclick|hidden|secret|pixel/);
});

test("line break tags allow no attributes and remain literal inside code", () => {
  const { render } = editor();
  const dom = render('First<br>Second<BR/>Third<br />Fourth<br onclick="alert(1)">literal\n\n`<br>`\n\n```\n<br>\n```');
  assert.equal(dom.querySelectorAll("br").length, 3);
  assert.ok(dom.textContent.includes('<br onclick="alert(1)">'));
  assert.equal(dom.querySelector("code").textContent, "<br>");
  assert.equal(dom.querySelector("pre code").textContent, "<br>");
});

test("unbounded clipboard input is rejected explicitly", () => {
  const { convert } = editor();
  assert.throws(() => convert("x".repeat(1000001)), /too large/);
  assert.throws(() => convert("<span>".repeat(65) + "text" + "</span>".repeat(65)), /too deeply nested/);
});

test("pasted code fences and fragment boundary spaces preserve their original text", () => {
  const { convert, render } = editor();
  const markdown = convert("<pre>before\n```js\n  sample\n```\nafter</pre>");
  assert.equal(render(markdown).querySelector("pre code").textContent, "before\n```js\n  sample\n```\nafter");
  assert.equal(convert(" <b>selection</b> "), " **selection** ");
  assert.equal(render(convert("<pre>a\n\n\nb</pre>")).querySelector("pre code").textContent, "a\n\n\nb");
});

test("custom fonts and alpha colors survive clipboard conversion", () => {
  const { convert, render } = editor();
  const markdown = convert('<span style="font-family:Arial, sans-serif;color:rgba(85,57,204,0.5)">Styled</span>');
  assert.match(markdown, /\{\{color:#5539cc80\|/);
  assert.equal(render(markdown).querySelector(".blog-text-font-custom").textContent, "Styled");
});

test("quoted clipboard paragraphs retain emphasis and explicit breaks", () => {
  const { convert, render } = editor();
  const markdown = convert('<blockquote><p>A <strong>quoted</strong> line<br>continued</p><p>Another paragraph</p></blockquote>');
  assert.match(markdown, /^> /);
  const dom = render(markdown);
  const quote = dom.querySelector("blockquote");
  assert.equal(quote.querySelector("strong").textContent, "quoted");
  assert.equal(quote.querySelectorAll("br").length, 3);
  assert.ok(quote.textContent.includes("Another paragraph"));
});
