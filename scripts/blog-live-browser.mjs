import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

function solidTextContrast(node) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const rgba = value => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const composite = (color, background) => color.slice(0, 3)
    .map((value, index) => value * color[3] / 255 + background[index] * (1 - color[3] / 255));
  const ancestors = [];
  for (let element = node; element; element = element.parentElement) ancestors.push(element);
  let background = [255, 255, 255];
  for (const element of ancestors.reverse()) background = composite(rgba(getComputedStyle(element).backgroundColor), background);
  const luminance = values => values.map(value => value / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const a = luminance(composite(rgba(getComputedStyle(node).color), background)), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

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
      body_markdown: "# Overview\n\n## Live edit\n\n**Current body**, not the deployment snapshot.\n\n{{color:#553fff|**Blurple**}} {{color:#0002|Alpha}} {{color:rainbow|Rainbow}}\n\n| Right to Left | Left to Right |\n| --- | --- |\n| Left | Right |\n\n### Details\n\nMore details.\n\n## Live edit\n\nDuplicate heading.\n\n## Live edit 2\n\n<script>window.unsafe = true</script>" }];
    let failure = false;
    let malformed = false;
    let serverNow = Date.parse("2026-11-14T12:00:00Z");
    const requests = [];
    await context.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (body, status = 200) => route.fulfill({
        status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body),
      });
      if (url.pathname.endsWith("/site_blog_public_posts")) {
        requests.push(url);
        if (failure) return json({ message: "Backend unavailable" }, 503);
        if (malformed) return json({ message: "Unexpected response" });
        const slug = url.searchParams.get("slug")?.slice(3);
        return json(rows.filter(post => post.published && Date.parse(post.published_at) <= serverNow && (!slug || post.slug === slug)));
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
    const blurple = page.locator('#blog-post-body [data-color="#553fff"]');
    assert.equal(await blurple.evaluate(node => getComputedStyle(node).color), "rgb(85, 63, 255)");
    assert.equal(await blurple.evaluate(node => getComputedStyle(node).backgroundColor), "rgb(255, 255, 255)");
    assert.equal(await page.locator("#blog-post-body .blog-rainbow-surface .blog-text-color-rainbow").count(), 1);
    assert.equal(await page.locator('#blog-post-body [data-color="#0002"]').count(), 1);
    await page.evaluate(() => window.BITS_THEME_PREFERENCE.apply("default", { scheme: "light" }));
    const tableContrast = await page.locator("#blog-post-body th").first().evaluate(solidTextContrast);
    assert.ok(tableContrast >= 4.5, `Light-mode table headers must meet AA; measured ${tableContrast}.`);
    await page.evaluate(() => {
      window.BITS_THEME_PREFERENCE.apply("tokyo-night", { scheme: "light" });
      document.querySelector("[data-blog-theme-settings]").showModal();
    });
    const pickerContrast = await page.locator(".blog-theme-settings .theme-picker > summary").evaluate(solidTextContrast);
    assert.ok(pickerContrast >= 4.5, `Tokyo Night light picker must meet AA; measured ${pickerContrast}.`);
    await page.evaluate(() => document.querySelector("[data-blog-theme-settings]").close());
    await page.evaluate(() => window.BITS_THEME_PREFERENCE.apply("default", { scheme: "dark" }));
    assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "Edited live summary");
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.shortbits.net/blog/articles/first-lab-notes/");
    assert.equal(await page.locator("[data-blog-schema]").evaluate(node => JSON.parse(node.textContent).headline), "Edited live title");
    assert.equal(await page.locator("script[data-seo]").evaluate(node =>
      JSON.parse(node.textContent)["@graph"].find(entry => entry["@type"] === "WebPage").description), "Edited live summary");
    assert.equal(requests[0].searchParams.get("slug"), "eq.first-lab-notes");
    const toc = page.locator("#blog-post-toc details");
    assert.equal(await toc.count(), 1);
    assert.equal(await toc.evaluate(node => node.open), false);
    if (shots) await page.screenshot({ path: join(shots, `toc-collapsed-${width}.png`), fullPage: true });
    assert.deepEqual(await toc.locator("a").allTextContents(), ["Overview", "Live edit", "Details", "Live edit", "Live edit 2"]);
    assert.equal(await toc.locator('a[href="#blog-heading-live-edit-2-2"]').count(), 1);
    await toc.locator("summary").press("Enter");
    assert.equal(await toc.evaluate(node => node.open), true);
    const firstHeadingIds = await page.locator("#blog-post-body :is(h1,h2,h3,h4,h5,h6)").evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(firstHeadingIds).size, firstHeadingIds.length);
    await toc.locator('a[href="#blog-heading-details"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(new URL(page.url()).hash, "#blog-heading-details");
    assert.ok(await page.locator("#blog-heading-details").evaluate(node => node.getBoundingClientRect().top >= 0));
    await toc.locator("summary").scrollIntoViewIfNeeded();
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map(issue => issue.id)), []);
    if (shots) await page.screenshot({ path: join(shots, `live-blog-${width}.png`), fullPage: true });

    const refresh = async () => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/site_blog_public_posts"));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await response;
    };
    await toc.evaluate(node => { window.__previousToc = node; });
    await refresh();
    assert.equal(await toc.evaluate(node => node === window.__previousToc && node.open), true, "Unchanged refresh preserves the disclosure and node");
    rows[0] = { ...rows[0], body_rich: { version: 1, doc: { type: "doc", content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Rich overview" }] },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Rich child" }] },
      { type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "Rich deepest" }] },
      { type: "paragraph", content: [{ type: "text", text: "Live rich body" },
        { type: "text", text: "Linked Blurple", marks: [{ type: "link", attrs: { href: "/blog/" } }, { type: "style", attrs: { color: "#553fff" } }] },
      ] },
    ] } } };
    await refresh();
    await toc.locator('a[href="#blog-heading-rich-deepest"]').waitFor();
    assert.deepEqual(await toc.locator("a").allTextContents(), ["Rich overview", "Rich child", "Rich deepest"]);
    assert.equal(await toc.evaluate(node => node.open), true, "Changed content preserves an explicitly opened disclosure");
    assert.equal(await blurple.evaluate(node => getComputedStyle(node).color), "rgb(85, 63, 255)");
    assert.equal(await page.locator('#blog-post-body [data-color="#553fff"] a').evaluate(node => getComputedStyle(node).color), "rgb(85, 63, 255)", "Linked rich text retains the author's enclosing color after live replacement");
    assert.equal(await page.locator("#blog-post-body .blog-rainbow-surface").count(), 0, "Reconciliation removes previous color wrappers");
    if (shots) await page.screenshot({ path: join(shots, `toc-rich-${width}.png`), fullPage: true });
    assert.equal(await page.locator("#blog-heading-details").count(), 0);
    rows[0] = { ...rows[0], body_rich: null, body_markdown: "No body headings remain." };
    await refresh();
    await toc.waitFor({ state: "detached" });
    rows = [];
    await refresh();
    await page.locator("#blog-post[hidden]").waitFor({ state: "attached" });
    assert.equal(await page.locator("#blog-post-body").textContent(), "");
    assert.equal(await page.locator("#blog-post-toc").textContent(), "");
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
    serverNow += 60001;
    await page.clock.fastForward(60001);
    await page.locator('#blog-post-list a[href="/blog/post.html?slug=due-scheduled-post"]').waitFor();
    await page.locator("#blog-search").fill("first lab");
    assert.equal(await page.locator("#blog-post-list article:visible").count(), 1);
    await Promise.all([
      page.waitForURL(`${server.origin}/blog/post.html?slug=due-scheduled-post`),
      page.locator('#blog-post-list a').click(),
    ]);
    await page.locator("#blog-post").waitFor({ state: "visible" });
    assert.equal(await page.locator("#blog-post-title").textContent(), fixture.title);
    assert.equal(await page.locator("#blog-post-toc details").evaluate(node => node.open), false, "Legacy live readers also start collapsed");
    rows[0] = { ...rows[0], title: "Timer refresh", body_markdown: "Timer refreshed body." };
    serverNow += 60001;
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
    console.log(`PASS ${width}px live blog: collapsed hierarchical TOC, keyboard jumps, unique anchors, Markdown/rich refresh, empty-heading cleanup, edits, safe Markdown, metadata, deletion/unpublishing, recreation, outage, due scheduling, polling, and new-post routing`);
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${server.origin}/blog/articles/first-lab-notes/`);
  assert.equal(await page.locator("#blog-post").isVisible(), true);
  assert.equal(await page.locator("#blog-post-title").textContent(), fixture.title);
  assert.match(await page.locator("#blog-post-body").textContent(), /./);
  const contents = page.locator("#blog-post-toc details");
  assert.equal(await contents.evaluate(node => node.open), false);
  await contents.locator("summary").press("Enter");
  const firstLink = contents.locator("a").first();
  const href = await firstLink.getAttribute("href");
  await firstLink.focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, href);
  assert.ok(await page.locator(href).evaluate(node => node.getBoundingClientRect().top >= 0));
  await page.emulateMedia({ media: "print" });
  assert.equal(await contents.isVisible(), false);
  assert.equal(await page.locator("[data-blog-schema]").evaluate(node => JSON.parse(node.textContent).headline), fixture.title);
  await context.close();
  console.log("PASS no-JavaScript static article, collapsed TOC/keyboard jumps, print omission and structured-data fallback");
} finally {
  await browser?.close();
  await server.close();
}
