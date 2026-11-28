import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const option = name => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`--${name} is required.`);
  return resolve(process.argv[index + 1]);
};
const posts = JSON.parse(await readFile(option("posts"), "utf8"));
assert.equal(posts.length, 2, "Use the two published public posts.");
assert.ok(posts.every(post => post.published));
const output = option("output");
await mkdir(output, { recursive: true });
const originIndex = process.argv.indexOf("--origin");
const server = originIndex < 0 ? await startSiteServer(option("root")) :
  { origin: new URL(process.argv[originIndex + 1]).origin, close: async () => {} };
const cssOverride = process.argv.includes("--override-css")
  ? await readFile(new URL("../blog/styles/blog-layout.css", import.meta.url), "utf8") : null;
const readingWidthIndex = process.argv.indexOf("--reading-width");
const readingWidth = readingWidthIndex < 0 ? "comfortable" : process.argv[readingWidthIndex + 1];
assert.ok(["comfortable", "wide", "full"].includes(readingWidth), "Choose a supported reading width.");
const readingCap = { comfortable: 1280, wide: 1600, full: Infinity }[readingWidth];
const browser = await chromium.launch({ headless: true });
const checks = [];
const accessibility = [];
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
let themes = [
  ["default", "dark"], ["default", "light"], ["html", "light"],
  ["rgb", "light", "rainbow"], ["aero-glass", "light", "rose"],
  ["aqua", "light", "graphite"], ["winamp", "dark", "classic"],
  ["ipod-classic", "light", "black"], ["tokyo-night", "light"],
  ["google", "light"], ["windows-95", "light"], ["m365", "light"],
  ["atari", "dark"], ["legacy-bios", "dark"], ["terminal", "dark"],
];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("bits-interface-theme", "default");
    localStorage.setItem("bits-seasonal-theme-dismissed", "thanksgiving");
    localStorage.setItem("bits-theme-debug", "enabled");
  });
  await context.addInitScript(value => localStorage.setItem("bits-blog-reading-width", value), readingWidth);
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__blog_layout_axe_test__.js")
      return route.fulfill({ contentType: "text/javascript", body: axeSource });
    if (cssOverride && url.pathname === "/blog/styles/blog-layout.css")
      return route.fulfill({ contentType: "text/css", body: cssOverride });
    if (originIndex >= 0) return route.continue();
    if (url.pathname.endsWith("/site_blog_public_posts")) {
      const slug = url.searchParams.get("slug")?.slice(3);
      return route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(posts.filter(post => !slug || post.slug === slug)) });
    }
    if (url.pathname.includes("/rest/v1/rpc/")) return route.fulfill({
      contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "0",
    });
    return route.continue();
  });
  const page = await context.newPage();
  if (process.argv.includes("--all-themes")) {
    await page.goto(`${server.origin}/blog/`, { waitUntil: "networkidle" });
    themes = await page.evaluate(() => window.BITS_THEME_PREFERENCE.getGroups()
      .flatMap(group => group.themes).map(theme => [theme.id, theme.schemes?.[0] || "dark"]));
  }
  const routes = [{ kind: "archive", slug: "archive", path: "/blog/" }, ...posts.flatMap(post => [
    { kind: "canonical", slug: post.slug, path: `/blog/articles/${post.slug}/` },
    { kind: "legacy", slug: post.slug, path: `/blog/post.html?slug=${post.slug}` },
  ])];
  for (const width of [2560, 1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(`${server.origin}${route.path}`, { waitUntil: "networkidle" });
      await page.locator(route.kind === "archive" ? "#blog-post-list article" : "#blog-post-body > *").first().waitFor();
      for (const [theme, scheme, variant] of themes) {
        await page.evaluate(async ({ theme, scheme, variant }) => {
          const loads = [];
          const watch = link => {
            if (!(link.tagName === "LINK" && link.rel === "stylesheet" || link.tagName === "SCRIPT" && link.src)) return;
            loads.push(new Promise((resolveLoad, rejectLoad) => {
              link.addEventListener("load", resolveLoad, { once: true });
              link.addEventListener("error", () => rejectLoad(new Error("Theme asset failed to load.")), { once: true });
            }));
          };
          const observer = new MutationObserver(records => {
            for (const record of records) {
              if (record.type === "attributes") watch(record.target);
              else for (const node of record.addedNodes) watch(node);
            }
          });
          observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
          if (variant) window.BITS_THEME_PREFERENCE.setVariant(theme, variant);
          window.BITS_THEME_PREFERENCE.apply(theme, { scheme });
          await new Promise(resolveLoad => setTimeout(resolveLoad, 0));
          for (let completed = 0; completed < loads.length;) {
            const pending = loads.slice(completed);
            completed = loads.length;
            await Promise.all(pending);
            await new Promise(resolveLoad => setTimeout(resolveLoad, 0));
          }
          observer.disconnect();
          await document.fonts.ready;
          await new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
        }, { theme, scheme, variant });
        const measurements = await page.evaluate(() => {
          const body = document.querySelector("#blog-post-body");
          const content = body || document.querySelector("#blog-post-list");
          const rect = content.getBoundingClientRect();
          const style = getComputedStyle(content);
          const card = document.querySelector("#blog-post-list article");
          const cardStyle = card && getComputedStyle(card);
          const shell = document.querySelector(".blog-shell");
          const shellStyle = getComputedStyle(shell);
          const parentStyle = getComputedStyle(content.parentElement);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          return {
            width: rect.width, left: rect.left, rightGutter: innerWidth - rect.right,
            availableWidth: shell.clientWidth - parseFloat(shellStyle.paddingLeft) - parseFloat(shellStyle.paddingRight)
              - parseFloat(parentStyle.borderLeftWidth) - parseFloat(parentStyle.borderRightWidth),
            characters: rect.width / context.measureText("0").width,
            font: style.fontFamily, fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight),
            cardTextWidth: card && card.getBoundingClientRect().width - parseFloat(cardStyle.paddingLeft)
              - parseFloat(cardStyle.paddingRight) - parseFloat(cardStyle.borderLeftWidth) - parseFloat(cardStyle.borderRightWidth),
            cardExcerptWidth: card?.querySelector("p:not(.blog-post-card-meta)")?.getBoundingClientRect().width,
            overflow: document.documentElement.scrollWidth - innerWidth,
            shellWidth: shell.getBoundingClientRect().width,
            readingWidth: document.documentElement.dataset.blogReadingWidth,
            colorBackings: [...document.querySelectorAll(".blog-color-readable, .blog-rainbow-surface")]
              .filter(node => getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)").length,
          };
        });
        const failures = [];
        if (measurements.readingWidth !== readingWidth) failures.push("Reading preference was not applied");
        if (measurements.shellWidth > readingCap + 1) failures.push("Reading width exceeds the selected cap");
        if (measurements.overflow > 1) failures.push("Page overflow");
        if (measurements.left < 12 || measurements.rightGutter < 12) failures.push("Gutters below 12px");
        if (!Number.isFinite(measurements.availableWidth)
          || Math.abs(measurements.width - measurements.availableWidth) > 1)
          failures.push("Content does not use the available shell width");
        if (route.kind !== "archive") {
          if (measurements.fontSize < 16) failures.push("Reading text below 16px");
          if (["default", "google", "windows-95", "html"].includes(theme)
            && measurements.width < Math.min(width, readingCap) - (width <= 600 ? 32 : 80))
            failures.push("Usable reading area is still squeezed");
          if (measurements.lineHeight / measurements.fontSize < 1.6) failures.push("Insufficient paragraph rhythm");
        }
        if (route.kind === "archive" && ["default", "google", "windows-95", "html"].includes(theme)) {
          if (!Number.isFinite(measurements.cardExcerptWidth)) failures.push("Archive excerpt measurement is missing");
          if (width <= 600 && measurements.cardExcerptWidth < width - 52)
            failures.push("Archive excerpt is squeezed on phones");
          if (measurements.cardExcerptWidth < measurements.cardTextWidth - 1)
            failures.push("Archive excerpt retains an inner width limit");
        }
        if (measurements.colorBackings) failures.push("Colored text backing");
        checks.push({ ...route, theme, scheme, variant, viewport: width, ...measurements, failures });
        if ((width === 1440 || width === 390) && (route.kind === "archive" || route.kind === "canonical" && theme === "default")) {
          if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({
            url: `${server.origin}/__blog_layout_axe_test__.js`,
          });
          const result = await page.evaluate(async () => {
            const result = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "link-name", "button-name"] } });
            return {
              violations: result.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => {
                const element = typeof node.target[0] === "string" ? document.querySelector(node.target[0]) : null;
                return { target: node.target, summary: node.failureSummary,
                  outsideBlog: element ? !element.closest(".blog-shell") : null };
              }) })),
              incomplete: result.incomplete.map(issue => issue.id),
            };
          });
          accessibility.push({ ...route, theme, scheme, viewport: width, ...result });
        }
        if ((width === 1440 || width === 390) && ["default", "google", "windows-95", "m365", "html", "atari"].includes(theme) && route.kind !== "legacy") {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: join(output, `${route.slug}-${theme}-${scheme}-${width}-top.png`) });
          if (route.kind === "canonical") {
            await page.locator("#blog-post-body").scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(output, `${route.slug}-${theme}-${scheme}-${width}-reading.png`) });
          }
        }
      }
    }
    console.log(`Layout checks completed at ${width}px.`);
  }
  await context.close();
  const summary = { cases: checks.length, failingCases: checks.filter(check => check.failures.length).length };
  await writeFile(join(output, "results.json"), JSON.stringify({ summary, checks, accessibility }, null, 2));
  console.log(JSON.stringify(summary));
  if (process.argv.includes("--assert")) {
    assert.equal(summary.failingCases, 0, "Reading layout measurements failed.");
    assert.equal(accessibility.filter(result => result.violations.some(issue =>
      issue.nodes.some(node => node.outsideBlog !== true))).length, 0, "Blog-surface accessibility checks failed.");
  }
} finally {
  await browser.close();
  await server.close();
}
