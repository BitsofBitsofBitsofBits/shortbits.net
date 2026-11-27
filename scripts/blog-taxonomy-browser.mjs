import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";
import { applyThemeAndWait } from "./theme-picker-helpers.mjs";

const option = name => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) throw new Error(`--${name} is required.`);
  return resolve(process.argv[index + 1]);
};
const posts = JSON.parse(await readFile(option("posts"), "utf8"));
assert.equal(posts.length, 2);
assert.ok(posts.every(post => post.published && post.series?.slug === "color-studies"));
const output = option("output");
await mkdir(output, { recursive: true });
const server = await startSiteServer(option("root"));
const browser = await chromium.launch({ headless: true });
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      localStorage.setItem("bits-theme-debug", "enabled");
      localStorage.setItem("bits-seasonal-theme-dismissed", "thanksgiving");
    });
    let rows = structuredClone(posts);
    let unavailable = false;
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
      if (url.pathname.endsWith("/site_blog_public_posts")) {
        if (unavailable) return json({ message: "Fixture unavailable" }, 503);
        const slug = url.searchParams.get("slug")?.slice(3);
        const series = url.searchParams.get("series->>slug")?.slice(3);
        return json(rows.filter(post => post.published && Date.parse(post.published_at) <= Date.now()
          && (!slug || post.slug === slug) && (!series || post.series?.slug === series)));
      }
      if (url.pathname.endsWith("/get_blog_post_views")) return json(1);
      if (url.pathname.includes("/rest/v1/")) return json([]);
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/blog/articles/${posts[0].slug}/`, { waitUntil: "networkidle" });
    await page.getByText("Part 1 of 2", { exact: true }).waitFor();
    let releaseImport, importStarted;
    const heldImport = new Promise(resolve => { releaseImport = resolve; });
    const requestedImport = new Promise(resolve => { importStarted = resolve; });
    const delayedImport = async route => {
      importStarted();
      await heldImport;
      await route.continue();
    };
    await context.route("**/collection-base.css*", delayedImport);
    let completed = false;
    const switching = applyThemeAndWait(page, { theme: "blueprint", scheme: "auto" }).then(() => { completed = true; });
    await requestedImport;
    assert.equal(completed, false, "A stylesheet with unresolved imports is not ready for measurement.");
    releaseImport();
    await switching;
    await context.unroute("**/collection-base.css*", delayedImport);
    const routes = ["/blog/", "/blog/tags/readability/", "/blog/series/color-studies/",
      ...posts.flatMap(post => [`/blog/articles/${post.slug}/`, `/blog/post.html?slug=${post.slug}`])];
    for (const path of routes) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      const article = path.includes("articles/") || path.includes("post.html");
      if (article) await page.getByText(/Part [12] of 2/, { exact: true }).waitFor();
      else await page.getByText("Archive synchronized.", { exact: true }).waitFor();
      for (const [theme, scheme] of [["default", "dark"], ["default", "light"], ["html", "light"], ["tokyo-night", "light"], ["terminal", "dark"]]) {
        await applyThemeAndWait(page, { theme, scheme });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} ${theme} overflow`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.interfaceTheme), theme);
        if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
        const axe = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "rule",
          values: ["color-contrast", "link-name", "button-name", "aria-dialog-name"] } }));
        results.push({ width, path, theme, scheme, violations: axe.violations, incomplete: axe.incomplete.map(item => item.id) });
        assert.deepEqual(axe.violations, [], `${path} ${theme} accessibility`);
      }
      if (path === "/blog/" || path === `/blog/articles/${posts[0].slug}/`) {
        await page.screenshot({ path: join(output, `${article ? "article" : "archive"}-${width}.png`), fullPage: !article });
        if (article) await page.locator("#blog-series-navigation").screenshot({ path: join(output, `series-${width}.png`) });
      }
    }
    await page.goto(`${server.origin}/blog/articles/${posts[0].slug}/`, { waitUntil: "networkidle" });
    const next = page.locator("#blog-series-navigation a[rel=next]");
    await next.waitFor();
    rows = [rows[0]];
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText("Part 1 of 1", { exact: true }).waitFor();
    assert.equal(await next.count(), 0);
    rows[0].tags = [{ name: "New live tag", slug: "new-live-tag" }];
    rows[0].series = { name: "New live series", slug: "new-live-series" };
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.locator('#blog-post-taxonomy a[href="/blog/?tag=new-live-tag"]').waitFor();
    await page.locator('#blog-series-navigation a[href="/blog/?series=new-live-series"]').waitFor();
    unavailable = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText(/Live updates are unavailable/, { exact: false }).waitFor();
    assert.equal(await page.locator("#blog-post").isVisible(), true);
    unavailable = false; rows = [];
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByText("That post does not exist or is not published.", { exact: true }).waitFor();
    assert.equal(await page.locator("#blog-series-navigation a").count(), 0);
    assert.equal(await page.locator("#blog-post-taxonomy a").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const page = await noScript.newPage();
  await page.goto(`${server.origin}/blog/series/color-studies/`);
  assert.equal(await page.locator("#blog-post-list article").count(), 2);
  await page.goto(`${server.origin}/blog/articles/${posts[0].slug}/`);
  assert.equal(await page.locator("#blog-series-navigation a[rel=next]").count(), 1);
  await noScript.close();
  console.log(`${results.length} taxonomy theme/layout/accessibility cases passed; imported stylesheet readiness, live metadata/removal and no-JavaScript navigation passed.`);
} finally {
  await writeFile(join(output, "results.json"), JSON.stringify(results, null, 2));
  await browser.close(); await server.close();
}
