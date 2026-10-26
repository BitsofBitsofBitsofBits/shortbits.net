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
      if (path === "/professional/resume/") {
        assert.equal(await page.locator("#resume-status").textContent(), "Saved resume is current.");
        assert.equal(await page.locator("#resume-refresh").isDisabled(), true);
      }
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
    await page.waitForFunction(() => document.querySelector("#build-link")?.dataset.commit);
    assert.match(await page.locator("#build-link").getAttribute("title"), /^Deployed .* UTC$/);
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
    await page.waitForFunction(() => /\d/.test(document.querySelector("#operator-local-time").textContent));
    assert.match(await page.locator("#operator-age").textContent(), /^\d+Y \d+D/);
    await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({ format: "Letter" });
    assert.ok(pdf.length > 1000, "Printable résumé must produce a nonempty PDF");
    await page.emulateMedia({ media: "screen" });
    await page.route("**/rest/v1/site_resume_profile?**", async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
      await route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify([{
          headline: "An explicitly updated headline", summary: "Updated after deployment.",
          location: "Carbondale, Kansas, US", updated_at: "2026-10-23T00:00:00Z",
        }]),
      });
    });
    await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator(".resume-sheet").evaluate((element) => element.classList.contains("is-loading")), false);
    await page.locator("#resume-summary").waitFor({ state: "visible" });
    assert.equal(await page.locator("#resume-summary").textContent(), "Practical support and dependable systems.");
    await page.waitForFunction(() => !document.querySelector("#resume-refresh").disabled);
    assert.equal(await page.locator("#resume-headline").textContent(), "IT Support & Systems");
    assert.ok(await page.evaluate(() => window.__testLayoutShift <= 0.1), `${width}px resume update prompt CLS`);
    await page.locator("#resume-refresh").click();
    assert.equal(await page.locator("#resume-headline").textContent(), "An explicitly updated headline");
    assert.equal(await page.locator("#resume-refresh").isDisabled(), true);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#resume-summary").textContent(), "Updated after deployment.");
    await page.emulateMedia({ media: "screen" });
    await page.unroute("**/rest/v1/site_resume_profile?**");
    await page.route("**/rest/v1/site_resume_education?**", (route) => route.fulfill({
      status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "{}",
    }));
    await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
    assert.match(await page.locator("#resume-status").textContent(), /incomplete/);
    assert.equal(await page.locator("#resume-refresh").isDisabled(), true);
    assert.equal(await page.locator("#resume-summary").textContent(), "Practical support and dependable systems.");
    await page.unroute("**/rest/v1/site_resume_education?**");
    await page.route("**/rest/v1/site_resume_profile?**", (route) => route.abort());
    await page.goto(`${server.origin}/professional/resume/`, { waitUntil: "networkidle" });
    assert.match(await page.locator("#resume-status").textContent(), /failed/);
    assert.equal(await page.locator("#resume-summary").isVisible(), true);
    assert.equal(await page.locator("#resume-refresh").isDisabled(), true);
    await page.unroute("**/rest/v1/site_resume_profile?**");
    const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
    const staticResume = await noScript.newPage();
    await staticResume.goto(`${server.origin}/professional/resume/`);
    assert.equal(await staticResume.locator("#resume-summary").isVisible(), true);
    await staticResume.emulateMedia({ media: "print" });
    assert.ok((await staticResume.pdf({ format: "Letter" })).length > 1000);
    await noScript.close();
    console.log(`PASS ${width}px immediate resume snapshot, explicit update, offline/partial data, no-JS and print`);
    await page.route(/\/admin\.js(?:\?|$)/, (route) => route.fulfill({
      contentType: "text/javascript", body: "/* Admin writes disabled in the offline publishing-status test. */",
    }));
    await page.goto(`${server.origin}/admin/#/blog`, { waitUntil: "networkidle" });
    const savedPosts = JSON.parse(await readFile(new URL("./fixtures/blog-posts.json", import.meta.url), "utf8"));
    await page.evaluate(async (posts) => {
      document.querySelector("#login-view").hidden = true;
      document.querySelector("#inbox-view").hidden = false;
      window.dispatchEvent(new CustomEvent("admin:authenticated"));
      await window.BITS_PUBLISHING_UI.update(posts);
    }, savedPosts);
    await page.locator('#blog-editor [data-admin-subsection="publishing"]').click();
    await page.locator('#blog-deployment-status[data-state="success"]').waitFor();
    const pendingPosts = savedPosts.filter((post) => post.slug !== "safe-markdown").map((post) => (
      post.slug === "first-lab-notes" ? { ...post, title: `${post.title} updated` } : post
    ));
    pendingPosts.push({ ...savedPosts[0], slug: "new-browser-post" });
    await page.evaluate((posts) => window.BITS_PUBLISHING_UI.update(posts), pendingPosts);
    assert.match(await page.locator("#blog-deployment-status").textContent(), /1 new, 1 changed, 1 removed/);
    assert.match(await page.locator("#blog-deployment-details").textContent(), /Still public until deployment removes them: safe-markdown/);
    assert.match(await page.locator("#blog-deployment-details").textContent(), /scheduled post/);
    await page.addScriptTag({ path: axePath });
    const publishingViolations = await page.evaluate(async () => (
      await axe.run(document.querySelector("#blog-editor"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      })
    ).violations.map((violation) => violation.id));
    assert.deepEqual(publishingViolations, [], "Publishing status accessibility");
    await page.route("**/blog/content-manifest.json?*", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
    await page.evaluate((posts) => window.BITS_PUBLISHING_UI.update(posts), savedPosts);
    assert.equal(await page.locator("#blog-deployment-status").getAttribute("data-state"), "error");
    assert.equal(await page.locator("#blog-deployment-refresh").isDisabled(), false);
    await page.unroute("**/blog/content-manifest.json?*");
    await page.evaluate((posts) => window.BITS_PUBLISHING_UI.update(posts), savedPosts);
    assert.equal(await page.locator("#blog-deployment-status").getAttribute("data-state"), "success");
    await page.evaluate(() => window.BITS_PUBLISHING_UI.clear());
    assert.equal(await page.locator("#blog-deployment-refresh").isDisabled(), true);
    assert.equal(await page.locator("#blog-deployment-details li").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "Publishing status must not overflow");
    console.log(`PASS ${width}px read-only publishing status: synchronized, pending, scheduled, error/retry, and sign-out reset`);
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
