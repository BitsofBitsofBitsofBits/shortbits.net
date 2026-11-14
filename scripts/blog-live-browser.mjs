import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const rootIndex = process.argv.indexOf("--root");
const shotsIndex = process.argv.indexOf("--screenshots");
const shots = shotsIndex < 0 ? null : resolve(process.argv[shotsIndex + 1]);
if (shots) await mkdir(shots, { recursive: true });
const server = await startSiteServer(resolve(rootIndex < 0 ? ".site-build" : process.argv[rootIndex + 1]));
const fixture = JSON.parse(await readFile(new URL("./fixtures/blog-posts.json", import.meta.url), "utf8"))
  .find(post => post.slug === "first-lab-notes");
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
let browser;
try {
  assert.equal((await fetch(`${server.origin}/blog/`)).status, 200);
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}), headless: true,
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let rows = [{ ...fixture, title: "Edited live title", excerpt: "Edited live summary",
      body_markdown: "## Live edit\n\n**Current body**, not the deployment snapshot.\n\n<script>window.unsafe = true</script>" }];
    let failure = false;
    let malformed = false;
    const requests = [];
    await context.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({
        status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body),
      });
      if (url.pathname.endsWith("/site_blog_posts")) {
        requests.push(url);
        if (failure) return json({ message: "Backend unavailable" }, 503);
        if (malformed) return json({ message: "Unexpected response" });
        const cutoff = Date.parse(url.searchParams.get("published_at").slice(4));
        const slug = url.searchParams.get("slug")?.slice(3);
        return json(rows.filter(post => post.published && Date.parse(post.published_at) <= cutoff && (!slug || post.slug === slug)));
      }
      if (url.pathname.endsWith("/get_blog_post_views")) return json(1);
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-11-14T12:00:00Z") });
    await page.goto(`${server.origin}/blog/articles/first-lab-notes/?slug=wrong-post`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#blog-post-title").textContent(), "Edited live title");
    assert.match(await page.locator("#blog-post-body").textContent(), /Current body/);
    assert.equal(await page.evaluate(() => window.unsafe), undefined);
    assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "Edited live summary");
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.shortbits.net/blog/articles/first-lab-notes/");
    assert.equal(await page.locator("[data-blog-schema]").evaluate(node => JSON.parse(node.textContent).headline), "Edited live title");
    assert.equal(await page.locator("script[data-seo]").evaluate(node =>
      JSON.parse(node.textContent)["@graph"].find(entry => entry["@type"] === "WebPage").description), "Edited live summary");
    assert.equal(requests[0].searchParams.get("slug"), "eq.first-lab-notes");
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => issue.id)), []);
    if (shots) await page.screenshot({ path: join(shots, `live-blog-${width}.png`), fullPage: true });

    const refresh = async () => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/site_blog_posts"));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await response;
    };
    rows = [];
    await refresh();
    await page.locator("#blog-post[hidden]").waitFor({ state: "attached" });
    assert.equal(await page.locator("#blog-post-body").textContent(), "");
    assert.match(await page.locator("#blog-post-status").textContent(), /does not exist or is not published/);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
    assert.equal(await page.locator("[data-blog-schema]").textContent(), "null");
    assert.equal(await page.locator("script[data-seo]").textContent(), "null");
    failure = true;
    await refresh();
    await page.waitForFunction(() => document.querySelector("#blog-post-status").textContent.includes("could not be loaded"));
    assert.equal(await page.locator("#blog-post").isVisible(), false, "Outage cannot resurrect a removed article");
    failure = false;
    rows = [{ ...fixture, title: "Same-slug recreation", body_markdown: "Recreated **current** body." }];
    await refresh();
    await page.waitForFunction(() => document.querySelector("#blog-post-title").textContent === "Same-slug recreation");
    assert.equal(await page.locator("#blog-post").isVisible(), true);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
    rows[0] = { ...rows[0], published: false };
    await refresh();
    await page.locator("#blog-post[hidden]").waitFor({ state: "attached" });

    rows = [{ ...fixture, slug: "due-scheduled-post", published_at: "2026-11-14T12:00:30Z" }];
    await page.goto(`${server.origin}/blog/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#blog-post-list article").count(), 0, "Future records are excluded");
    await page.clock.fastForward(60001);
    await page.locator('#blog-post-list a[href="/blog/post.html?slug=due-scheduled-post"]').waitFor();
    await page.locator("#blog-search").fill("first lab");
    assert.equal(await page.locator("#blog-post-list article:visible").count(), 1);
    await page.locator('#blog-post-list a').click();
    await page.waitForFunction(() => !document.querySelector("#blog-post").hidden);
    assert.equal(await page.locator("#blog-post-title").textContent(), fixture.title);
    rows[0] = { ...rows[0], title: "Timer refresh", body_markdown: "Timer refreshed body." };
    await page.clock.fastForward(60001);
    await page.waitForFunction(() => document.querySelector("#blog-post-title").textContent === "Timer refresh");

    failure = true;
    await page.goto(`${server.origin}/blog/articles/first-lab-notes/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#blog-post-title").textContent(), fixture.title, "Outage retains initial HTML");
    assert.match(await page.locator("#blog-post-status").textContent(), /latest deployment/);
    malformed = true;
    failure = false;
    await refresh();
    assert.equal(await page.locator("#blog-post").isVisible(), true, "Malformed success is not definitive absence");
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await context.close();
    console.log(`PASS ${width}px live blog: edits, safe Markdown, metadata, deletion/unpublishing, recreation, outage, due scheduling, polling, and new-post routing`);
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${server.origin}/blog/articles/first-lab-notes/`);
  assert.equal(await page.locator("#blog-post").isVisible(), true);
  assert.equal(await page.locator("#blog-post-title").textContent(), fixture.title);
  assert.match(await page.locator("#blog-post-body").textContent(), /./);
  assert.equal(await page.locator("[data-blog-schema]").evaluate(node => JSON.parse(node.textContent).headline), fixture.title);
  await context.close();
  console.log("PASS no-JavaScript static article and structured-data fallback");
} finally {
  await browser?.close();
  await server.close();
}
