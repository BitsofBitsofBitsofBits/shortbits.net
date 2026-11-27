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
const server = await startSiteServer(option("root"));
const browser = await chromium.launch({ headless: true });
const checks = [];
const accessibility = [];
const themes = [
  ["default", "dark"], ["default", "light"], ["html", "light"],
  ["rgb", "light", "rainbow"], ["aero-glass", "light", "rose"],
  ["aqua", "light", "graphite"], ["winamp", "dark", "classic"],
  ["ipod-classic", "light", "black"], ["tokyo-night", "light"],
];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("bits-interface-theme", "default");
    localStorage.setItem("bits-seasonal-theme-dismissed", "thanksgiving");
    localStorage.setItem("bits-theme-debug", "enabled");
  });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
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
  const routes = [{ kind: "archive", slug: "archive", path: "/blog/" }, ...posts.flatMap(post => [
    { kind: "canonical", slug: post.slug, path: `/blog/articles/${post.slug}/` },
    { kind: "legacy", slug: post.slug, path: `/blog/post.html?slug=${post.slug}` },
  ])];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(`${server.origin}${route.path}`, { waitUntil: "networkidle" });
      await page.locator(route.kind === "archive" ? "#blog-post-list article" : "#blog-post-body > *").first().waitFor();
      for (const [theme, scheme, variant] of themes) {
        await page.evaluate(({ theme, scheme, variant }) => {
          if (variant) window.BITS_THEME_PREFERENCE.setVariant(theme, variant);
          window.BITS_THEME_PREFERENCE.apply(theme, { scheme });
        }, { theme, scheme, variant });
        await page.waitForFunction(() => {
          const sheet = document.querySelector("#bits-theme-stylesheet");
          return !sheet || Boolean(sheet.sheet);
        });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
        const measurements = await page.evaluate(() => {
          const body = document.querySelector("#blog-post-body");
          const content = body || document.querySelector("#blog-post-list");
          const rect = content.getBoundingClientRect();
          const style = getComputedStyle(content);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          return {
            width: rect.width, left: rect.left, rightGutter: innerWidth - rect.right,
            characters: rect.width / context.measureText("0").width,
            font: style.fontFamily, fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight),
            overflow: document.documentElement.scrollWidth - innerWidth,
            colorBackings: [...document.querySelectorAll(".blog-color-readable, .blog-rainbow-surface")]
              .filter(node => getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)").length,
          };
        });
        const failures = [];
        if (measurements.overflow > 1) failures.push("Page overflow");
        if (measurements.left < 20 || measurements.rightGutter < 20) failures.push("Gutters below 20px");
        if (route.kind !== "archive") {
          if (measurements.fontSize < 16) failures.push("Reading text below 16px");
          if (width >= 1024 && (measurements.characters < 45 || measurements.characters > 80 || measurements.width > 860)) failures.push("Reading measure outside desktop bounds");
          if (measurements.lineHeight / measurements.fontSize < 1.6) failures.push("Insufficient paragraph rhythm");
        }
        if (measurements.colorBackings) failures.push("Colored text backing");
        checks.push({ ...route, theme, scheme, variant, viewport: width, ...measurements, failures });
        if ((width === 1440 || width === 390) && (route.kind === "archive" || route.kind === "canonical" && theme === "default")) {
          if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({
            path: createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
          });
          const result = await page.evaluate(async () => {
            const result = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "link-name", "button-name"] } });
            return {
              violations: result.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })),
              incomplete: result.incomplete.map(issue => issue.id),
            };
          });
          accessibility.push({ ...route, theme, scheme, viewport: width, ...result });
        }
        if ((width === 1440 || width === 390) && theme === "default" && route.kind !== "legacy") {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: join(output, `${route.slug}-${scheme}-${width}-top.png`) });
          if (route.kind === "canonical") {
            await page.locator("#blog-post-body").scrollIntoViewIfNeeded();
            await page.screenshot({ path: join(output, `${route.slug}-${scheme}-${width}-reading.png`) });
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
    assert.equal(accessibility.filter(result => result.violations.length).length, 0, "Supporting accessibility checks failed.");
  }
} finally {
  await browser.close();
  await server.close();
}
