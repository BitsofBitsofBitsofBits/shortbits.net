import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";
const args = process.argv.slice(2), index = args.indexOf("--root");
const server = await startSiteServer(resolve(index < 0 ? ".site-build" : args[index + 1]));
const outputIndex = args.indexOf("--output");
const output = outputIndex < 0 ? null : resolve(args[outputIndex + 1]);
if (output) await mkdir(output, { recursive: true });
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}) });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    let enabled = false, state = "playing", status = 200, age = 0, requests = 0, now = Date.now();
    const title = "<script>Not executable</script> // Owner's film";
    const item = { title, series: "A series", season: 1, episode: 2, durationMs: 180_000, progressMs: 10_000, isPlaying: true };
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", async route => {
      const url = new URL(route.request().url()), headers = { "Access-Control-Allow-Origin": "*" };
      if (url.pathname.endsWith("/site-config.js")) return route.fulfill({ contentType: "text/javascript",
        body: `window.SITE_CONFIG=Object.freeze({jellyfinPresenceEnabled:${enabled}});` });
      if (url.pathname.endsWith("/functions/v1/jellyfin-presence")) {
        requests++;
        return route.fulfill({ status, contentType: "application/json", headers,
          body: JSON.stringify({ state, item: ["playing", "paused"].includes(state) ? { ...item, isPlaying: state === "playing" } : null,
            updatedAt: new Date(now - age).toISOString(), expiresAt: new Date(now - age + 90_000).toISOString() }) });
      }
      if (url.pathname.endsWith("/functions/v1/spotify-now-playing")) return route.fulfill({
        contentType: "application/json", headers,
        body: JSON.stringify({ item: { title: "Spotify remains playing", artists: ["Artist"], durationMs: 180_000, albumArt: null },
          isPlaying: true, progressMs: 1000, servedAt: now, sessionStartedAt: new Date(now - 300_000).toISOString() }) });
      if (url.pathname.endsWith("/functions/v1/youtube-presence")) return route.fulfill({
        contentType: "application/json", headers,
        body: JSON.stringify({ item: { videoId: "abcdefghijk", title: "YouTube remains playing", channel: "Channel", durationMs: 180_000 },
          isPlaying: true, progressMs: 1000, updatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 90_000).toISOString(),
          sessionStartedAt: new Date(now - 600_000).toISOString() }) });
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({ contentType: "application/json", headers, body: "[]" });
      if (url.pathname.includes("/functions/v1/")) return route.fulfill({ status: 503, headers, contentType: "application/json", body: "{}" });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: now });
    await page.goto(`${server.origin}/nowplaying/`, { waitUntil: "networkidle" });
    assert.equal(requests, 0, "Disabled Jellyfin performs no presence requests");
    assert.equal(await page.locator("#jellyfin-widget").isVisible(), false);
    enabled = true;
    for (const route of ["/online/", "/nowplaying/"]) {
      state = "playing"; status = 200; age = 0;
      now = await page.evaluate(() => Date.now());
      await page.goto(`${server.origin}${route}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelector("#jellyfin-widget").dataset.state === "playing");
      if (route === "/online/") {
        await page.locator("#media-next").focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#media-selection").textContent(), "JELLYFIN // 3 OF 3");
      }
      assert.equal(await page.locator("#jellyfin-widget").isVisible(), true);
      assert.equal(await page.locator("#jellyfin-track").textContent(), title);
      assert.equal(await page.locator("#jellyfin-track script").count(), 0);
      assert.equal(await page.locator("#jellyfin-series").textContent(), "A series // S1 E2");
      assert.equal(await page.locator("#media-status").textContent(), "",
        "Jellyfin intentionally shows update age, not a missing-session warning");
      assert.equal(await page.locator("#jellyfin-widget img, #jellyfin-widget a").count(), 0,
        "No private-server artwork, item URLs or playback links are exposed");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.addScriptTag({ path: axePath });
      assert.deepEqual(await page.evaluate(async () => (await axe.run("#media-player", {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      })).violations.map(value => value.id)), []);
    }
    if (output) await page.screenshot({ path: join(output, `jellyfin-mocked-preview-${width}.png`), fullPage: true });
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    for (const theme of ["default", "fluent", "windows-95", "frutiger-eco"]) {
      await page.locator("#presentation-theme").selectOption(theme);
      await page.waitForFunction(id => {
        const theme = window.BITS_INTERFACE_THEMES.find(theme => theme.id === id);
        const sheet = document.querySelector("#bits-theme-stylesheet");
        return document.documentElement.dataset.interfaceTheme === id
          && (theme.stylesheet || theme.experimental ? Boolean(sheet?.sheet)
            && [...sheet.sheet.cssRules].filter(rule => rule.type === CSSRule.IMPORT_RULE)
              .every(rule => rule.styleSheet?.cssRules.length) : !sheet);
      }, theme);
      for (const scheme of ["dark", "light"]) {
        await page.locator("#presentation-scheme").selectOption(scheme);
        await page.waitForFunction(scheme => document.documentElement.dataset.colorScheme === scheme, scheme);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
        assert.deepEqual(await page.evaluate(async () => (await axe.run("#media-player", {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })).violations.map(value => ({ id: value.id, nodes: value.nodes.map(node => ({
          target: node.target, failure: node.failureSummary,
        })) }))), [], `${width}px ${theme} ${scheme} Jellyfin accessibility`);
      }
    }
    const refresh = async () => {
      now = await page.evaluate(() => Date.now());
      const request = page.waitForResponse(response => response.url().includes("/jellyfin-presence"));
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      await request;
    };
    state = "paused";
    await refresh();
    await page.waitForFunction(() => document.querySelector("#jellyfin-widget").dataset.state === "paused");
    const position = await page.locator("#jellyfin-current-time").textContent();
    await page.clock.runFor(2000);
    assert.equal(await page.locator("#jellyfin-current-time").textContent(), position);
    state = "playing"; age = 88_500;
    await refresh();
    await page.waitForFunction(() => document.querySelector("#jellyfin-widget").dataset.state === "playing");
    await page.clock.runFor(2500);
    assert.equal(await page.locator("#jellyfin-widget").getAttribute("data-state"), "expired");
    assert.ok(!(await page.locator("#jellyfin-track").textContent()).includes(title));
    age = 0;
    for (const next of ["idle", "expired", "unavailable"]) {
      state = next;
      await refresh();
      await page.waitForFunction(state => document.querySelector("#jellyfin-widget").dataset.state === state, next);
      assert.equal(await page.locator("#jellyfin-widget").isVisible(), true, "Presentation states remain visible");
      assert.ok(!(await page.locator("#jellyfin-track").textContent()).includes(title));
    }
    state = "playing"; status = 503;
    await refresh();
    await page.waitForFunction(() => document.querySelector("#jellyfin-widget").dataset.state === "unavailable");
    assert.equal(await page.locator("#spotify-widget").getAttribute("data-state"), "playing");
    assert.equal(await page.locator("#youtube-widget").getAttribute("data-state"), "playing");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenRequests = requests;
    await page.clock.runFor(61_000);
    assert.equal(requests, hiddenRequests, "Hidden pages do not poll Jellyfin");
    status = 200; state = "playing";
    now = await page.evaluate(() => Date.now());
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelector("#jellyfin-widget").dataset.state === "playing");
    assert.ok(requests > hiddenRequests, "Returning to the page refreshes and recovers Jellyfin");
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px Jellyfin: opt-in, three-source keyboard navigation, safe text, pause/idle/expiry/outage, independent providers and accessibility`);
  }
} finally { await browser?.close(); await server.close(); }
