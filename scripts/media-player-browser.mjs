import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./site-server.mjs";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "." : args[rootIndex + 1]);
const server = await startSiteServer(root);
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
    let youtubePlaying = true;
    let youtubeStartedAt = Date.now() - 600_000;
    let youtubeTitle = "<script>Untrusted title</script> & a video";
    let youtubeDuration = 180_000;
    let youtubeExpiresAfter = 90_000;
    let youtubeStatus = 200;
    let youtubeVideoId = "abcdefghijk";
    let youtubeAvatar = "https://yt3.ggpht.com/example-channel=s88-c";
    let thumbnailFails = false;
    let untrustedImageRequests = 0;
    const spotifyStartedAt = Date.now() - 300_000;
    const errors = [];
    await context.addInitScript(() => sessionStorage.setItem("bits-boot-seen-v1", "true"));
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      const now = Date.now();
      if (url.pathname.endsWith("/functions/v1/youtube-presence")) return route.fulfill({
        status: youtubeStatus, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ item: { videoId: youtubeVideoId, title: youtubeTitle, channel: "Example channel",
          channelAvatarUrl: youtubeAvatar, durationMs: youtubeDuration },
          isPlaying: youtubePlaying, progressMs: 12_000, updatedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + youtubeExpiresAfter).toISOString(), sessionStartedAt: new Date(youtubeStartedAt).toISOString() }),
      });
      if (url.hostname === "yt3.ggpht.com") return route.fulfill({
        status: url.pathname.includes("broken") ? 404 : 200, contentType: "image/svg+xml",
        body: url.pathname.includes("broken") ? "Image unavailable"
          : '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="#15a"/></svg>',
      });
      if (url.hostname === "i.ytimg.com") return route.fulfill({
        status: thumbnailFails ? 404 : 200, contentType: "image/svg+xml",
        body: thumbnailFails ? "Image unavailable"
          : '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#a51"/></svg>',
      });
      if (url.hostname === "untrusted.example") untrustedImageRequests++;
      if (url.pathname.endsWith("/functions/v1/spotify-now-playing")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ item: { title: "A Spotify song", artists: ["An artist"], durationMs: 180_000, albumArt: null },
          isPlaying: true, progressMs: 1000, servedAt: Date.now(), sessionStartedAt: new Date(spotifyStartedAt).toISOString() }),
      });
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({
        contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: "[]",
      });
      if (url.pathname.includes("/functions/v1/")) return route.fulfill({
        status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"error":"Offline fixture"}',
      });
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${server.origin}/online/`, { waitUntil: "networkidle" });
    const youtube = page.locator("#youtube-widget");
    const spotify = page.locator("#spotify-widget");
    await youtube.waitFor({ state: "visible" });
    const artwork = page.locator("#youtube-artwork");
    await artwork.waitFor({ state: "visible" });
    assert.equal(await artwork.getAttribute("src"), youtubeAvatar);
    assert.equal(await artwork.getAttribute("data-kind"), "channel");
    assert.equal(await artwork.getAttribute("referrerpolicy"), "no-referrer");
    assert.equal(await artwork.evaluate(image => image.naturalWidth), 88);
    assert.equal(await youtube.locator(".spotify-placeholder").isVisible(), false);
    assert.equal(await spotify.isVisible(), false, "Longer continuous YouTube session is first when both are playing");
    assert.equal(await page.locator("#youtube-track").textContent(), youtubeTitle, "Metadata is text, never HTML");
    assert.equal(await page.locator("#youtube-track script").count(), 0);
    assert.equal(await page.locator("#youtube-video-link").getAttribute("href"), "https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(await page.locator("#media-navigation").isVisible(), true);
    const button = page.getByRole("button", { name: "Next media source" });
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await spotify.isVisible(), true);
    await page.getByRole("button", { name: "Previous media source" }).click();
    assert.equal(await youtube.isVisible(), true);
    assert.ok(await youtube.evaluate(element => element.scrollWidth <= element.clientWidth + 1), "No card overflow");
    await page.addScriptTag({ path: axePath });
    assert.deepEqual(await page.evaluate(async () => (await axe.run("#media-player", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    })).violations.map(item => item.id)), [], "Media controls are accessible");
    for (const theme of ["spotify", "youtube"]) {
      await page.locator("#interface-theme-select").selectOption(theme, { force: true });
      await page.waitForFunction(theme => {
        const sheet = document.querySelector("#bits-theme-stylesheet");
        return document.documentElement.dataset.interfaceTheme === theme
          && sheet?.href.includes(`/${theme}.css`) && sheet.sheet;
      }, theme);
      assert.equal(await spotify.isVisible(), false, `${theme} theme keeps the inactive source hidden`);
      assert.equal(await youtube.isVisible(), true, `${theme} theme displays the selected video`);
      assert.equal(await artwork.isVisible(), true, `${theme} theme displays YouTube artwork`);
      assert.ok(await youtube.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${theme} theme has no card overflow`);
    }
    await page.locator("#interface-theme-select").selectOption("default", { force: true });
    await page.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "default");

    const refresh = () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    youtubeAvatar = undefined;
    await refresh();
    await page.waitForFunction(() => {
      const image = document.querySelector("#youtube-artwork");
      return !image.hidden && image.dataset.kind === "thumbnail" && image.naturalWidth === 320;
    });
    assert.equal(await artwork.getAttribute("src"), "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg",
      "Older extensions without an icon use the canonical video thumbnail");
    assert.equal(await artwork.evaluate(image => getComputedStyle(image).objectFit), "contain", "Thumbnails are not stretched or cropped");
    const size = await artwork.boundingBox();
    assert.equal(size.width, width === 390 ? 48 : 56);
    assert.equal(size.height, size.width, "Artwork preserves the existing card layout");
    youtubeVideoId = "ZYXWVUTSRQP";
    await refresh();
    await page.waitForFunction(() => document.querySelector("#youtube-artwork").src.includes("/ZYXWVUTSRQP/"));
    youtubeAvatar = "https://yt3.ggpht.com/broken-channel=s88-c";
    await refresh();
    await page.waitForFunction(() => {
      const image = document.querySelector("#youtube-artwork");
      return image.dataset.kind === "thumbnail" && !image.hidden && image.src.includes("/ZYXWVUTSRQP/");
    });
    thumbnailFails = true;
    youtubeVideoId = "12345678901";
    await refresh();
    await page.waitForFunction(() => document.querySelector("#youtube-widget .spotify-placeholder").title === "YouTube artwork unavailable.");
    assert.equal(await artwork.isVisible(), false);
    assert.equal(await youtube.locator(".spotify-placeholder").isVisible(), true, "Broken images retain a usable text placeholder");
    thumbnailFails = false;
    youtubeAvatar = "https://yt3.ggpht.com/recovered-channel=s88-c";
    await refresh();
    await page.waitForFunction(() => {
      const image = document.querySelector("#youtube-artwork");
      return image.dataset.kind === "channel" && !image.hidden;
    });
    youtubeAvatar = "https://untrusted.example/tracking.png";
    await refresh();
    await page.locator("#media-status").filter({ hasText: "YouTube status unavailable" }).waitFor();
    assert.equal(untrustedImageRequests, 0, "Unapproved icon URLs are rejected before any image request");
    youtubeAvatar = null;
    await refresh();
    await youtube.waitFor({ state: "visible" });
    await artwork.waitFor({ state: "visible" });
    youtubePlaying = false;
    await refresh();
    await spotify.waitFor({ state: "visible" });
    assert.equal(await youtube.isVisible(), false, "Playing Spotify beats older paused YouTube");
    await button.click();
    assert.equal(await youtube.isVisible(), true, "Paused videos remain accessible using arrows");
    const pausedTime = await page.locator("#youtube-current-time").textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator("#youtube-current-time").textContent(), pausedTime);
    await page.evaluate(({ startedAt }) => window.dispatchEvent(new CustomEvent("media:spotify", {
      detail: { available: true, isPlaying: false, sessionStartedAt: new Date(startedAt).toISOString() },
    })), { startedAt: spotifyStartedAt });
    assert.equal(await youtube.isVisible(), true, "Longer session wins when both are paused");
    youtubePlaying = true;
    youtubeStartedAt = Date.now() - 60_000;
    await page.evaluate(({ startedAt }) => window.dispatchEvent(new CustomEvent("media:spotify", {
      detail: { available: true, isPlaying: true, sessionStartedAt: new Date(startedAt).toISOString() },
    })), { startedAt: spotifyStartedAt });
    await refresh();
    await spotify.waitFor({ state: "visible" });
    assert.equal(await youtube.isVisible(), false, "Older Spotify session wins even if a newer YouTube session is active");

    youtubeStatus = 503;
    await refresh();
    await page.locator("#media-status").filter({ hasText: "YouTube status unavailable" }).waitFor();
    assert.equal(await spotify.isVisible(), true);
    assert.equal(await page.locator("#media-navigation").isVisible(), false);
    youtubeStatus = 200;
    youtubeDuration = 0;
    youtubeExpiresAfter = 1500;
    youtubeStartedAt = Date.now() - 900_000;
    await refresh();
    await youtube.waitFor({ state: "visible" });
    assert.equal(await page.locator("#youtube-duration").textContent(), "LIVE");
    await spotify.waitFor({ state: "visible" });
    assert.equal(await youtube.isVisible(), false, "Expired reports disappear without requiring another request");
    assert.deepEqual(errors, []);
    assert.equal(await artwork.getAttribute("src"), null, "Expiry clears old artwork");
    console.log(`PASS ${width}px media carousel: channel icons, fitted thumbnail fallback, image errors, safe image URLs, continuous session order, manual arrows, paused clock, expiry, themes, and accessibility`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
