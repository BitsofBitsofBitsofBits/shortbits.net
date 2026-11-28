import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const option = name => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`--${name} is required.`);
  return resolve(process.argv[index + 1]);
};
const root = option("root"), output = option("output");
const posts = JSON.parse(await readFile(option("posts"), "utf8"));
assert.equal(posts.length, 2);
assert.ok(posts.every(post => post.published));
await mkdir(output, { recursive: true });
const server = await startSiteServer(root);
const browser = await chromium.launch({ headless: true });
const checks = [];
async function context(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce", ...options });
  await context.addInitScript(() => {
    localStorage.setItem("bits-interface-theme", "default");
    localStorage.setItem("bits-theme-debug", "enabled");
    localStorage.setItem("bits-seasonal-theme-dismissed", "thanksgiving");
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
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  return context;
}
async function settled(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function measure(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".blog-shell").getBoundingClientRect();
    const content = document.querySelector("#blog-post-body") || document.querySelector("#blog-post-list");
    const body = content.getBoundingClientRect();
    return { shell: shell.width, content: body.width, left: body.left, right: innerWidth - body.right,
      font: getComputedStyle(content).fontFamily, overflow: document.documentElement.scrollWidth - innerWidth,
      reading: document.documentElement.dataset.blogReadingWidth };
  });
}
try {
  const active = await context();
  const page = await active.newPage();
  const routes = ["/blog/", ...posts.flatMap(post => [`/blog/articles/${post.slug}/`, `/blog/post.html?slug=${post.slug}`])];
  const caps = { comfortable: 1280, wide: 1600, full: Infinity };
  for (const width of [2560, 1920, 1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const route of routes) {
      await page.goto(`${server.origin}${route}`);
      await settled(page);
      const originalFont = (await measure(page)).font;
      const headingIds = await page.locator("#blog-post-body :is(h1,h2,h3,h4,h5,h6)").evaluateAll(nodes => nodes.map(node => node.id));
      const tocCount = await page.locator(".blog-toc").count();
      await page.getByRole("button", { name: "Theme settings", exact: true }).click();
      for (const choice of ["comfortable", "wide", "full"]) {
        await page.getByLabel("Reading width", { exact: true }).selectOption(choice);
        const geometry = await measure(page);
        assert.ok(geometry.overflow <= 1, `${width}px ${choice} ${route}: overflow`);
        assert.ok(Math.abs(geometry.shell - Math.min(width - (width <= 600 ? 8 : 16), caps[choice])) <= 1);
        assert.equal(geometry.font, originalFont);
        assert.equal(await page.locator(".blog-toc").count(), tocCount);
        assert.deepEqual(await page.locator("#blog-post-body :is(h1,h2,h3,h4,h5,h6)").evaluateAll(nodes => nodes.map(node => node.id)), headingIds);
        checks.push({ width, route, choice, ...geometry });
      }
      await page.getByRole("button", { name: "Close theme settings" }).click();
      await page.reload();
      await settled(page);
      assert.equal((await measure(page)).reading, "full");
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${server.origin}/blog/articles/${posts[0].slug}/`);
  await settled(page);
  const second = await active.newPage();
  await second.goto(`${server.origin}/blog/`);
  await settled(second);
  await page.getByRole("button", { name: "Theme settings", exact: true }).click();
  await page.getByLabel("Reading width", { exact: true }).selectOption("wide");
  await second.waitForFunction(() => document.documentElement.dataset.blogReadingWidth === "wide");
  await page.getByRole("button", { name: "Close theme settings" }).click();
  await page.evaluate(() => {
    const body = document.querySelector("#blog-post-body");
    const table = document.createElement("div");
    table.className = "blog-markdown-table";
    table.innerHTML = "<table><tbody><tr>" + "<td>Long table content</td>".repeat(20) + "</tr></tbody></table>";
    const pre = document.createElement("pre");
    pre.textContent = "VeryLongCodeToken".repeat(100);
    body.append(table, pre);
  });
  for (const choice of ["comfortable", "wide", "full"]) {
    await page.evaluate(value => window.BITS_BLOG_READING_WIDTH.select(value), choice);
    assert.ok((await measure(page)).overflow <= 1, `Wide table/code in ${choice}`);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".blog-shell")).maxWidth), "none");
    assert.equal(await page.locator(".public-nav").isVisible(), false);
    await page.emulateMedia({ media: "screen" });
  }
  await page.reload();
  await settled(page);
  for (const choice of ["comfortable", "wide", "full"]) {
    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    await page.getByLabel("Reading width", { exact: true }).selectOption(choice);
    await page.screenshot({ path: join(output, `settings-${choice}-1920.png`) });
    await page.getByRole("button", { name: "Close theme settings" }).click();
    await page.screenshot({ path: join(output, `article-${choice}-1920.png`) });
    await page.locator("#blog-post-body").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, `article-${choice}-1920-reading.png`) });
    await page.evaluate(() => scrollTo(0, 0));
  }
  await page.evaluate(() => window.BITS_THEME_PREFERENCE.apply("m365", { scheme: "light" }));
  await page.waitForFunction(() => document.documentElement.dataset.m365Chrome === "active"
    && parseFloat(getComputedStyle(document.body).paddingLeft) === 224);
  await settled(page);
  for (const choice of ["comfortable", "wide", "full"]) {
    await page.evaluate(value => window.BITS_BLOG_READING_WIDTH.select(value), choice);
    const expanded = await measure(page);
    assert.ok(expanded.left >= 236 && expanded.right >= 12 && expanded.overflow <= 1, `Expanded M365 ${choice}`);
    await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
    await page.waitForFunction(() => document.body.classList.contains("m365-nav-collapsed")
      && document.querySelector(".m365-nav").getBoundingClientRect().width < 53
      && parseFloat(getComputedStyle(document.body).paddingLeft) === 52);
    const collapsed = await measure(page);
    assert.ok(collapsed.left >= 64 && collapsed.right >= 12 && collapsed.overflow <= 1, `Collapsed M365 ${choice}`);
    checks.push({ choice, theme: "m365", expanded, collapsed });
    await page.getByRole("button", { name: "Expand navigation", exact: true }).click();
    await page.waitForFunction(() => !document.body.classList.contains("m365-nav-collapsed")
      && parseFloat(getComputedStyle(document.body).paddingLeft) === 224);
  }
  await page.setViewportSize({ width: 390, height: 1080 });
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingLeft) === 0);
  assert.ok((await measure(page)).overflow <= 1);
  await page.evaluate(() => window.BITS_THEME_PREFERENCE.apply("default", { scheme: "dark" }));
  await settled(page);
  await page.evaluate(() => window.BITS_BLOG_READING_WIDTH.select("wide"));
  const originalPost = structuredClone(posts[0]);
  posts[0].title = "Local live-refresh width fixture";
  posts[0].body_rich = null;
  posts[0].body_markdown = "# Refreshed heading\n\nA private test response, not an author edit.\n\n## Nested refreshed heading";
  posts[0].updated_at = new Date().toISOString();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.getByRole("heading", { name: "Local live-refresh width fixture", exact: true }).waitFor();
  assert.equal((await measure(page)).reading, "wide");
  assert.equal(await page.locator(".blog-toc").count(), 1);
  assert.equal(await page.locator(".blog-toc a").count(), 2);
  assert.equal(await page.locator("#blog-post-body").getByRole("heading", { name: "Refreshed heading", exact: true }).textContent(), "Refreshed heading");
  Object.assign(posts[0], originalPost);
  await active.close();

  const native = await context({ javaScriptEnabled: false });
  const noJs = await native.newPage();
  await noJs.goto(`${server.origin}/blog/articles/${posts[0].slug}/`);
  assert.ok(Math.abs((await measure(noJs)).shell - 1280) <= 1);
  assert.ok(await noJs.locator("#blog-post-body :is(h1,h2,h3,h4,h5,h6)").count());
  assert.equal(await noJs.locator(".blog-toc").count(), 1);
  await native.close();

  const blocked = await context();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked for fixture", "SecurityError"); } });
  });
  const restricted = await blocked.newPage();
  await restricted.goto(`${server.origin}/blog/`);
  await settled(restricted);
  await restricted.getByRole("button", { name: "Theme settings", exact: true }).click();
  await restricted.getByLabel("Reading width", { exact: true }).selectOption("wide");
  assert.equal((await measure(restricted)).reading, "wide");
  assert.match(await restricted.locator("#blog-reading-width-status").textContent(), /storage is unavailable/);
  await blocked.close();
  await writeFile(join(output, "behavior-results.json"), JSON.stringify({ cases: checks.length, checks }, null, 2));
  console.log(`Passed ${checks.length} width/route/sidebar cases, reload/cross-tab persistence, stable fonts/TOC, live refresh, wide content, print, no-JS default and blocked storage.`);
} finally { await browser.close(); await server.close(); }
