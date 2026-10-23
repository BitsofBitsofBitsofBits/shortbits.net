import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? ".site-build" : args[rootIndex + 1]);
const server = await startSiteServer(root);
let browser;
const errors = [];
try {
  assert.equal((await fetch(`${server.origin}/?choose`)).status, 200, "Test server must be responsive");
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route(/cloudflareinsights|challenges\.cloudflare|lanyard\.rest/, (route) => route.abort());
    await context.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const name = new URL(request.url()).pathname.split("/").pop();
      let data = [];
      if (name === "site_resume_profile") data = [{
        id: "primary", enabled: true, location: "Carbondale, Kansas, US",
        availability: "Available for professional conversations", updated_at: "2026-10-22T00:00:00Z",
        headline: "IT Support & Systems", summary: "Practical support and dependable systems.",
      }];
      if (name === "site_resume_entries") data = [{
        position: 1, role: "IT Technician", organization: "Independent test fixture",
        period: "2024 - Present", summary: "Support and systems administration.", technologies: "PowerShell, Windows",
      }];
      if (name === "site_blog_posts") data = JSON.parse(await readFile(new URL("./fixtures/blog-posts.json", import.meta.url), "utf8"))
        .filter((post) => post.published && Date.parse(post.published_at) <= Date.now());
      if (name === "record_site_analytics" || name === "hardware_watch") data = null;
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) });
    });
    await context.route("**/functions/v1/**", (route) => route.fulfill({
      status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Service unavailable in offline smoke test" }),
    }));
    await context.addInitScript(() => {
      sessionStorage.setItem("bits-boot-seen-v1", "true");
      localStorage.removeItem("bits-site-choice");
      window.__testLayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__testLayoutShift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}px: ${error.message}`));
    for (const path of [
      "/?choose", "/online/", "/professional/", "/professional/resume/",
      "/projects/", "/projects/homelab/", "/projects/shortbits/", "/blog/",
      "/blog/articles/first-lab-notes/",
    ]) {
      await page.goto(`${server.origin}${path}`, { waitUntil: "networkidle" });
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      })).violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) })));
      assert.deepEqual(violations, [], `${width}px ${path}: accessibility violations`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${width}px ${path}: horizontal overflow`);
      if (path === "/professional/") {
        const shift = await page.evaluate(() => window.__testLayoutShift);
        assert.ok(shift <= 0.1, `${width}px professional CLS ${shift} exceeds 0.1`);
        await page.locator('#contact-form input[name="name"]').focus();
        await page.locator('.contact-turnstile[data-state="error"]').waitFor();
        await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", (route) => route.fulfill({
          status: 200, contentType: "text/javascript",
          body: `window.turnstile = {
            render: (slot, options) => { queueMicrotask(() => options.callback("test-token")); return 1; },
            remove: () => {}, reset: () => {}, getResponse: () => "test-token"
          }; window.bitsTurnstileReady();`,
        }));
        await page.locator(".contact-turnstile-retry").click();
        await page.locator('.contact-turnstile[data-state="verified"]').waitFor();
        await page.unroute("https://challenges.cloudflare.com/turnstile/v0/api.js**");
        console.log(`PASS ${width}px retryable contact verification`);
      }
      console.log(`PASS ${width}px ${path}: accessibility and overflow`);
    }
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => /\/arcade\.js/.test(entry.name))), false, "Arcade must not load before it is opened");
    await page.keyboard.press("Control+k");
    await page.addScriptTag({ path: axePath });
    const launcherViolations = await page.evaluate(async () => (
      await axe.run(document.querySelector("#bits-launcher"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      })
    ).violations.map((violation) => violation.id));
    assert.deepEqual(launcherViolations, [], "Launcher dialog accessibility");
    await page.locator("#bits-launcher-search").fill("settings");
    await page.keyboard.press("Enter");
    await page.locator("#settings-window").waitFor({ state: "visible" });
    assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest("#settings-window"))), "Opening a result must focus its window");
    await page.keyboard.press("Escape");
    await page.locator("#settings-window").waitFor({ state: "hidden" });
    await page.keyboard.press("Control+k");
    await page.locator("#bits-launcher-search").fill("no-such-bit-123");
    assert.equal(await page.locator("#bits-launcher-results button").count(), 0);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#bits-launcher").evaluate((element) => element.open), false);
    await page.waitForFunction(() => document.activeElement.getClientRects().length > 0, undefined, { timeout: 5000 });
    if (width > 900) {
      await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("arcade"));
      await page.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => /\/arcade\.js/.test(entry.name)));
    }
    await page.goto(`${server.origin}/online/?window=about`, { waitUntil: "networkidle" });
    await page.locator("#about-window").waitFor({ state: "visible" });
    await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "Letter" });
    assert.ok(pdf.length > 1000, "Printable résumé must produce a nonempty PDF");
    await page.emulateMedia({ media: "screen" });
    const runtimeScript = /\/script\.js(?:\?|$)/;
    await page.route(runtimeScript, (route) => route.abort("failed"));
    await page.goto(`${server.origin}/online/`, { waitUntil: "domcontentloaded" });
    await page.locator('html[data-runtime="error"]').waitFor();
    await page.locator("#bits-runtime-retry").waitFor({ state: "visible" });
    await page.unroute(runtimeScript);
    await page.locator("#bits-runtime-retry").click();
    await page.locator('html[data-runtime="ready"]').waitFor();
    console.log(`PASS ${width}px explicit startup failure and safe retry`);
    console.log(`PASS ${width}px launcher, linked windows, lazy arcade, résumé PDF`);
    await context.close();
  }
  assert.deepEqual(errors, [], "Uncaught browser errors");
  console.log("Browser smoke checks passed. Third-party verification and live data are mocked; production integration still requires manual verification.");
} finally {
  if (browser) await browser.close();
  await server.close();
}
