import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const channelId = `UC${"a".repeat(22)}`;
const fixtures = [
  { position: 1, title: "Example creator", platform: "YouTube", channel_url: "https://www.youtube.com/@example", note: "Tech and projects", youtube_channel_id: channelId },
  { position: 2, title: "Another creator", platform: "Twitch", channel_url: "https://www.twitch.tv/example", note: null, youtube_channel_id: null },
];
const server = await startSiteServer(root);
const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    let creators = fixtures;
    let videoStatus = 200;
    let listStatus = 200;
    let listRequests = 0;
    let videoRequests = 0;
    const errors = [];
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/rest/v1/")) {
        const isCreators = url.pathname.endsWith("/site_creators");
        if (isCreators) {
          listRequests++;
          assert.equal(url.searchParams.get("enabled"), "eq.true");
          assert.equal(url.searchParams.get("order"), "sort_order.asc,position.asc");
        }
        return route.fulfill({
          status: isCreators ? listStatus : 200, contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(isCreators ? creators : []),
        });
      }
      if (url.pathname.endsWith("/functions/v1/creator-videos")) {
        videoRequests++;
        return route.fulfill({
          status: videoStatus, contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ videos: [{
            channelId, unavailable: false,
            video: { title: "<script>not executable</script> & latest upload", url: "https://www.youtube.com/watch?v=abcdefghijk", publishedAt: "2026-10-25T00:00:00Z" },
          }] }),
        });
      }
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.runtime === "ready");
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    assert.equal(listRequests, 0, "closed feed must not query creators");
    assert.equal(videoRequests, 0, "closed feed must not fetch videos");
    await page.evaluate(() => window.BITS_DESKTOP_WINDOWS.open("creators"));
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    assert.equal(await page.locator("#creators-list > li").count(), 2);
    assert.equal(await page.locator(".creator-latest a").getAttribute("href"), "https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(await page.locator(".creator-latest script").count(), 0);
    assert.equal(await page.locator("#creators-list > li").last().locator(".creator-latest").count(), 0);
    assert.ok(await page.locator(".creator-latest a").textContent().then((text) => text.includes("<script>")));
    assert.ok(await page.evaluate(() => {
      const content = document.querySelector("#creators-window .desktop-window-content");
      return content.scrollWidth <= content.clientWidth + 1;
    }), "creator feed must not overflow horizontally");
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => (await axe.run(document.querySelector("#creators-window"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    })).violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })));
    assert.deepEqual(violations, [], `${width}px creator accessibility`);
    videoStatus = 503;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "warning");
    assert.equal(await page.locator("#creators-list > li").count(), 2, "video outage must retain creator links");
    creators = [fixtures[1]];
    const before = videoRequests;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-list").children.length === 1);
    assert.equal(videoRequests, before, "profile-only creators need no video request");
    creators = [];
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("awaiting operator"));
    listStatus = 503;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").dataset.state === "error");
    listStatus = 200;
    creators = fixtures;
    videoStatus = 200;
    await page.locator("#creators-refresh").click();
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    assert.deepEqual(errors, []);
    await page.goto(`${server.origin}/online/?window=creators`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#creators-status").textContent.includes("10 minutes"));
    console.log(`PASS ${width}px creator feed: lazy loading, channel/profile links, latest upload, accessibility, outages, retry, and deep links`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/supabase-config.js") return route.fulfill({
      contentType: "text/javascript",
      body: `
        window.SUPABASE_CONFIG = { url: "https://test.example", anonKey: "test-key" };
        window.__creatorRows = [{ position: 1, title: "Original", platform: "YouTube", channel_url: "https://www.youtube.com/@example", youtube_channel_id: null, note: null, sort_order: 0, enabled: true }];
        window.createSiteSupabaseClient = () => ({
          auth: { getSession: async () => ({ data: { session: null }, error: null }) },
          from(table) {
            let operation = "select", values, position;
            const query = {
              select() { return query; }, order() { return query; },
              eq(key, value) { position = value; return query; },
              insert(payload) { operation = "insert"; values = payload; return query; },
              update(payload) { operation = "update"; values = payload; return query; },
              delete() { operation = "delete"; return query; },
              then(resolve) {
                if (table !== "site_creators") throw new Error("Unexpected editor table " + table);
                if (operation === "insert") window.__creatorRows.push(values);
                if (operation === "update") Object.assign(window.__creatorRows.find(row => row.position === position), values);
                if (operation === "delete") window.__creatorRows = window.__creatorRows.filter(row => row.position !== position);
                return Promise.resolve({ data: structuredClone(window.__creatorRows), error: null }).then(resolve);
              }
            };
            return query;
          }
        });`,
    });
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${server.origin}/admin/#/creators`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await loadCreators();
    loginView.hidden = true;
    inboxView.hidden = false;
    window.dispatchEvent(new CustomEvent("admin:authenticated"));
  });
  await page.locator("#creators-entry-add").click();
  const newEntry = page.locator("#creators-slots fieldset").last();
  await newEntry.locator('[data-entry-field="title"]').fill("New creator");
  await newEntry.locator('[data-entry-field="platform"]').fill("Twitch");
  await newEntry.locator('[data-entry-field="channel_url"]').fill("https://www.twitch.tv/new");
  await newEntry.locator('[data-entry-field="sort_order"]').fill("10");
  await newEntry.locator('[data-entry-field="youtube_channel_id"]').fill("@invalid");
  await newEntry.locator('[data-entry-field="enabled"]').check();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => document.querySelector("#creators-admin-status").dataset.state === "error");
  assert.equal(await page.evaluate(() => window.__creatorRows.length), 1, "invalid IDs must not save");
  await newEntry.locator('[data-entry-field="youtube_channel_id"]').fill("");
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => document.querySelector("#creators-admin-status").textContent.startsWith("Creators updated."));
  assert.equal(await page.evaluate(() => window.__creatorRows[1].sort_order), 10);
  await page.locator("#creators-slots fieldset").first().locator('[data-entry-field="enabled"]').uncheck();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => window.__creatorRows[0].enabled === false);
  await page.locator("#creators-slots fieldset").last().getByRole("button", { name: /Remove creator/ }).click();
  await page.locator("#creators-submit").click();
  await page.waitForFunction(() => window.__creatorRows.length === 1);
  assert.deepEqual(errors, []);
  console.log("PASS Admin creator editor: navigation, add, validate, save numeric order, hide, and remove");
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
