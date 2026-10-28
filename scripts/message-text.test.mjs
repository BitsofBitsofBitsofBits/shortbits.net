import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const markdown = readFileSync(new URL("../shared/scripts/markdown.js", import.meta.url), "utf8");
const source = readFileSync(new URL("../shared/scripts/message-text.js", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../shared/styles/styles.css", import.meta.url), "utf8");
function setup({ device = {} } = {}) {
  const { document } = parseHTML("<html><body></body></html>");
  let now = new Date(2026, 9, 26, 13, 14, 15).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const window = { location: { origin: "https://example.test", hostname: "example.test" } };
  const context = vm.createContext({ window, document, URL, Intl, Date: Clock, navigator: device });
  vm.runInContext(markdown, context);
  vm.runInContext(source, context);
  const target = document.createElement("p");
  return { document, window, target, text: window.BITS_MESSAGE_TEXT,
    now: new Date(now), advance: (milliseconds) => { now += milliseconds; } };
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

test("combined font, size and color commands preserve nested styles without leaving braces in the message", () => {
  const { target, text, window, document, now } = setup();
  const source = "Before {{font:serif|{{size:large|{{color:red|**%day%**}}}}}} after {{size:small|last}}";
  text.render(target, { text: source, markup: true });
  assert.ok(target.querySelector(".blog-text-font-serif .blog-text-size-large .blog-text-color-red strong"));
  assert.equal(target.querySelector(".blog-text-size-small").textContent, "last");
  assert.equal(target.textContent, `Before ${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now)} after last`);
  const blog = document.createElement("div");
  blog.append(window.BITS_MARKDOWN.render("{{font:serif|{{size:large|Nested}}}}"));
  assert.equal(blog.querySelector(".blog-text-font-serif .blog-text-size-large").textContent, "Nested");
  for (const value of ["{{font:bad|{{size:large|literal}}}}", "{{font:serif|{{size:large|unclosed}}"]) {
    text.render(target, { text: value, markup: true });
    assert.equal(target.textContent, value);
    assert.equal(target.querySelector("span"), null);
  }
});

test("adding safe message-only inline rendering does not remove links or images from normal blog Markdown", () => {
  const { document, window } = setup();
  const root = document.createElement("div");
  root.append(window.BITS_MARKDOWN.render("[Blog link](https://example.test) ![Blog image](https://example.test/image.png)"));
  assert.ok(root.querySelector("a"));
  assert.ok(root.querySelector("img"));
});

test("all 24 shared font choices have safe styles and render in messages and blog posts", () => {
  const { text, target, document, window } = setup();
  assert.equal(Object.keys(window.BITS_MARKDOWN.fonts).length, 24);
  for (const id of Object.keys(window.BITS_MARKDOWN.fonts)) {
    const markup = `{{font:${id}|Sample **bold**}}`;
    text.render(target, { text: markup, markup: true });
    assert.equal(target.textContent, "Sample bold");
    assert.equal(target.querySelector(`.blog-text-font-${id} strong`).textContent, "bold");
    assert.match(stylesheet, new RegExp(`\\.blog-text-font-${id}\\s*\\{[^}]*font-family:`));
    const blog = document.createElement("div");
    blog.append(window.BITS_MARKDOWN.render(markup));
    assert.equal(blog.querySelector(`.blog-text-font-${id}`).textContent, "Sample bold");
  }
  for (const id of ["unknown", "url(https://example.test/font)", 'arial" onclick="alert(1)']) {
    const markup = `{{font:${id}|literal}}`;
    text.render(target, { text: markup, markup: true });
    assert.equal(target.textContent, markup);
    assert.equal(target.querySelector("span,[onclick]"), null);
  }
});

test("custom installed fonts normalize safely, preserve case and survive typewriter rendering and blog output", () => {
  const { text, target, document, window } = setup();
  for (const [input, expected] of [
    ["Aptos, Arial,sans-serif", '"Aptos", "Arial", sans-serif'],
    ["'Aptos Display', monospace", '"Aptos Display", monospace'],
    ['"Yu Gothic", system-ui', '"Yu Gothic", system-ui'],
    ["游ゴシック, serif", '"游ゴシック", serif'],
    ["123 Font, SANS-SERIF", '"123 Font", sans-serif'],
  ]) {
    assert.equal(window.BITS_MARKDOWN.customFontFamily(input), expected);
    const option = { text: `{{font:custom:${input}|**👩‍💻%year%**}}`, markup: true };
    text.render(target, option);
    assert.equal(target.textContent, "👩‍💻2026");
    assert.equal(target.querySelector(".blog-text-font-custom").style.fontFamily, expected);
    for (const length of [0, 1, 3, 5, 2]) {
      text.render(target, option, { length });
      assert.equal(target.textContent, text.prepare(option).characters.slice(0, length).join(""));
      if (length) assert.equal(target.querySelector(".blog-text-font-custom").style.fontFamily, expected);
    }
    const blog = document.createElement("div");
    blog.append(window.BITS_MARKDOWN.render(`{{font:custom:${input}|Words}}`));
    assert.equal(blog.querySelector(".blog-text-font-custom").style.fontFamily, expected);
    assert.equal(blog.textContent, "Words");
  }
});

test("invalid custom fonts remain literal and never add CSS rules or external resources", () => {
  const { text, target, window } = setup();
  for (const value of [
    "", " ", "Arial,", ",Arial", "Arial,,serif", '"Unclosed', "Unclosed'",
    "inherit", "initial", "unset", "revert", "revert-layer", "Arial; color:red",
    "url(https://example.test/font)", "var(--font-family)", "Arial!important",
    '<img src=x onerror=alert(1)>', "Arial\nDisplay", "A".repeat(201),
    "{{color:red", "Arial|injection", "Arial}", '"Arial" onmouseover="evil"',
  ]) {
    assert.equal(window.BITS_MARKDOWN.customFontFamily(value), null, value);
    if (!value.includes("|") && !value.includes("}")) {
      const markup = `{{font:custom:${value}|literal}}`;
      text.render(target, { text: markup, markup: true });
      assert.equal(target.textContent, markup);
      assert.equal(target.querySelector("span,style,link,img,[onmouseover]"), null);
    }
  }
  assert.equal(window.BITS_MARKDOWN.customFontFamily("A".repeat(198)), `"${"A".repeat(198)}"`);
  assert.equal(window.BITS_MARKDOWN.customFontFamily("A".repeat(199)), null, "Normalized stacks also respect the limit");
});

test("live date/time placeholders use one local instant and preserve unknown or escaped tokens", () => {
  const { text, now } = setup();
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(now);
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(now);
  const day = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);
  const month = new Intl.DateTimeFormat(undefined, { month: "long" }).format(now);
  assert.equal(text.plainText("%CURRENTDATE% / %date% / %day% / %time% / %year% / %month% / %dayofmonth%"),
    `${date} / ${date} / ${day} / ${time} / 2026 / ${month} / 26`);
  assert.equal(text.plainText("%hour%:%minute%:%second% / %timezone%"),
    `13:14:15 / ${new Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  assert.equal(text.plainText("50% CPU; %%time%%; %% ; %unknown%; %constructor%"),
    "50% CPU; %time%; % ; %unknown%; %constructor%");
});

test("each snapshot stays stable during typing, correction and history, but reused templates get fresh values", () => {
  const { text, target, advance } = setup();
  const template = { text: "**%time%** tyop", markup: true, correctedText: "**%time%** typo" };
  const occurrence = text.snapshot(template);
  const first = text.prepare(occurrence);
  advance(61_000);
  assert.notEqual(text.plainText(template), first.text);
  for (const length of [0, 3, 5, Infinity, 4, 0]) {
    text.render(target, occurrence, { length });
    assert.equal(target.textContent, first.characters.slice(0, length).join(""));
  }
  assert.equal(text.prepare(occurrence), first, "A captured message compiles only once");
  assert.equal(text.snapshot(occurrence), occurrence, "History preserves the original context");
  const corrected = { ...occurrence, text: occurrence.correctedText };
  assert.equal(text.plainText(corrected), first.text.replace("tyop", "typo"));
  const next = text.snapshot(template);
  assert.notEqual(text.plainText(next), first.text);
  assert.equal(template.text, "**%time%** tyop", "Stored templates are never mutated");
  assert.equal(JSON.stringify(occurrence), JSON.stringify(template), "Runtime context is not serialized into backups");
  const before = text.plainText(template);
  advance(1_000);
  assert.notEqual(text.plainText(template), before, "Uncaptured dynamic objects must not stay cached forever");
});

test("interpolated browser data remains literal after markup parsing and supports grapheme truncation", () => {
  const language = "👩‍💻e\u0301 **NOT BOLD** {{color:red|NOT RED}} <img src=x onerror=alert(1)> %year%";
  const { text, target } = setup({ device: { language } });
  const option = text.snapshot({ text: "**%language%**", markup: true });
  text.render(target, option);
  assert.equal(target.querySelectorAll("strong").length, 1);
  assert.equal(target.querySelector("strong").textContent, language);
  assert.equal(target.querySelector("img,script,span"), null);
  text.render(target, option, { length: 2, prefix: "%year%", suffix: "%browser%" });
  assert.equal(target.textContent, "%year%👩‍💻e\u0301%browser%", "Only authored message text interpolates");
  text.render(target, "Plain %language%");
  assert.equal(target.textContent, `Plain ${language}`);
  assert.equal(target.querySelector("strong,img"), null);
});

for (const [agent, browser, os] of [
  ["Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130", "Microsoft Edge", "Windows"],
  ["Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36 OPR/115", "Opera", "Linux"],
  ["Mozilla/5.0 (Linux; Android 14) Chrome/130 SamsungBrowser/26", "Samsung Internet", "Android"],
  ["Mozilla/5.0 (X11; CrOS x86_64) Chrome/130 Safari/537.36", "Google Chrome", "ChromeOS"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/130", "Firefox", "macOS"],
  ["Mozilla/5.0 (iPhone) FxiOS/130 Version/17 Safari/605.1", "Firefox", "iOS"],
  ["Mozilla/5.0 (iPad) CriOS/130 Safari/605.1", "Google Chrome", "iOS"],
  ["Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1", "Safari", "macOS"],
  ["custom private browser", "Unknown browser", "Unknown OS"],
]) {
  test(`friendly browser/OS detection: ${browser} on ${os}`, () => {
    const { text } = setup({ device: { userAgent: agent, language: "en-GB" } });
    assert.equal(text.plainText("%useragent% / %browser% / %os% / %language% / %hostname%"),
      `${browser} / ${browser} / ${os} / en-GB / example.test`);
  });
}

test("low-entropy Client Hints recognize Edge without exposing raw UA or requesting high-entropy data", () => {
  const { text } = setup({ device: {
    userAgent: "Chrome/130", userAgentData: {
      brands: [{ brand: "Not_A Brand" }, { brand: "Chromium" }, { brand: "Microsoft Edge" }],
      getHighEntropyValues() { assert.fail("Message placeholders must not request identifying data"); },
    },
  } });
  assert.equal(text.plainText("%browser%"), "Microsoft Edge");
  const samsung = setup({ device: {
    userAgent: "Android Chrome/130 SamsungBrowser/26",
    userAgentData: { brands: [{ brand: "Chromium" }, { brand: "Google Chrome" }] },
  } });
  assert.equal(samsung.text.plainText("%browser%"), "Samsung Internet", "Generic Chrome hints do not mask specific browsers");
  assert.equal(text.plainText("%language%"), "Unknown language");
});
