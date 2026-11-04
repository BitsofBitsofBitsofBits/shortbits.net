import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? ".site-build" : args[rootIndex + 1]);
const fixture = JSON.parse(await readFile(new URL("./fixtures/featured-project.json", import.meta.url), "utf8"));
const server = await startSiteServer(root);
const browser = await chromium.launch({
  ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
  headless: true,
});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    let release;
    let mode = "published";
    const projectReady = new Promise(resolveReady => { release = resolveReady; });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/site_featured_project")) {
        await projectReady;
        return route.fulfill({
          status: mode === "offline" ? 503 : 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(mode === "published" ? [fixture] : []),
        });
      }
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "[]",
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    const section = page.locator("#featured-project-section");
    assert.equal(await section.isVisible(), true, "Published project must not wait for live data");
    assert.equal(await page.locator("#featured-project-title").textContent(), fixture.title);
    const before = await page.locator("#media-player").boundingBox();
    release();
    await page.waitForLoadState("networkidle");
    assert.equal((await page.locator("#media-player").boundingBox()).y, before.y,
      "Identical live project refresh must not move the media player");
    mode = "offline";
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await section.isVisible(), true, "Outages retain the deployment snapshot");
    mode = "empty";
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await section.isVisible(), false, "Successful unpublishing hides the snapshot");

    let runtimeRelease;
    const runtimeReady = new Promise(resolveReady => { runtimeRelease = resolveReady; });
    await page.route("**/professional/scripts/runtime.js*", async route => {
      await runtimeReady;
      return route.continue();
    });
    await page.goto(`${server.origin}/professional/`, { waitUntil: "commit" });
    await page.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length > 0);
    assert.equal(await page.locator(".profile-description").isVisible(), true,
      "The LCP text must paint without waiting for enhancement downloads");
    assert.equal(await page.locator("style[data-professional-styles]").count(), 1);
    const mainBefore = await page.locator("#main").boundingBox();
    runtimeRelease();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("#profile-theme-select").isVisible(), true);
    assert.equal((await page.locator("#main").boundingBox()).y, mainBefore.y,
      "Theme controls must hydrate without moving the main content");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: first-paint Professional content, stable theme hydration, featured snapshot, unchanged refresh, outage, and unpublishing`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
