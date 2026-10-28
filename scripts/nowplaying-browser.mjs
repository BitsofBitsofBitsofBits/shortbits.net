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
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#175a72"/></svg>';
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.BITS_BROWSER_CHANNEL ? { channel: process.env.BITS_BROWSER_CHANNEL } : {}),
    headless: true,
  });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width > 700 ? 900 : 1000 }, reducedMotion: "reduce" });
    let fixtureNow = Date.now();
    let spotifyStatus = 200;
    let youtubeStatus = 200;
    let youtubeExpiresAfter = 90_000;
    let spotifyRequests = 0;
    let youtubeRequests = 0;
    let historyRequests = 0;
    const errors = [];
    const sockets = [];
    let spotify = {
      item: { title: "A presentation song", artists: ["An example artist"], collection: "Example album",
        albumArt: "https://i.scdn.co/image/presentation-album", durationMs: 180_000,
        spotifyUrl: "https://open.spotify.com/track/Example123" },
      isPlaying: true, progressMs: 12_000, sessionStartedAt: new Date(fixtureNow - 600_000).toISOString(),
    };
    let youtube = {
      item: { videoId: "abcdefghijk", title: "<script>Watched pixels</script> & a very long presentation title",
        channel: "An example channel", channelAvatarUrl: "https://yt3.ggpht.com/presentation=s88-c", durationMs: 240_000 },
      isPlaying: true, progressMs: 12_000, sessionStartedAt: new Date(fixtureNow - 900_000).toISOString(),
    };
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      const json = (body, status = 200) => route.fulfill({
        status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body),
      });
      if (url.pathname.endsWith("/functions/v1/spotify-now-playing")) {
        spotifyRequests++;
        if (url.search) historyRequests++;
        return json(spotifyStatus === 200 ? { ...spotify, servedAt: fixtureNow } : { error: "Spotify offline" }, spotifyStatus);
      }
      if (url.pathname.endsWith("/functions/v1/youtube-presence")) {
        youtubeRequests++;
        return json(youtubeStatus === 200 ? { ...youtube, updatedAt: new Date(fixtureNow).toISOString(),
          expiresAt: new Date(fixtureNow + youtubeExpiresAfter).toISOString() } : { error: "YouTube offline" }, youtubeStatus);
      }
      if (url.pathname.endsWith("/functions/v1/discord-presence")) {
        return json({ enrolled: true, status: "online", userId: "202220288459538442" });
      }
      if (["i.scdn.co", "yt3.ggpht.com", "i.ytimg.com"].includes(url.hostname)) {
        return route.fulfill({ contentType: "image/svg+xml", body: image });
      }
      if (url.pathname.includes("/rest/v1/")) {
        historyRequests++;
        return json([]);
      }
      return url.origin === server.origin ? route.continue() : route.abort();
    });
    await context.routeWebSocket("wss://api.lanyard.rest/socket", socket => {
      sockets.push(socket);
      socket.onMessage(raw => {
        if (JSON.parse(raw).op === 2) {
          socket.send(JSON.stringify({ op: 0, t: "INIT_STATE", d: { listening_to_spotify: false } }));
        }
      });
      socket.send(JSON.stringify({ op: 1, d: { heartbeat_interval: 30_000 } }));
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: fixtureNow });
    const text = (selector, expected) => page.waitForFunction(({ selector, expected }) =>
      document.querySelector(selector)?.textContent === expected, { selector, expected });
    const refresh = async () => {
      fixtureNow = await page.evaluate(() => Date.now());
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    };
    const assertLayout = async () => {
      // Wait for real resize rendering, not only animation frames from the mocked clock.
      await page.screenshot();
      const { first, second, height, viewportWidth, overflow } = await page.evaluate(() => {
        const bounds = (selector) => {
          const element = document.querySelector(selector);
          if (!element?.getClientRects().length) return null;
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          first: bounds("#spotify-widget"), second: bounds("#youtube-widget"),
          height: innerHeight, viewportWidth: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const geometry = JSON.stringify({ height, viewportWidth, first, second });
      assert.ok(first && second, "Both statuses remain visible");
      assert.equal(viewportWidth, width, `Layout uses the requested viewport: ${geometry}`);
      assert.equal(height, page.viewportSize().height, `Layout uses the requested viewport height: ${geometry}`);
      if (width > 700) {
        assert.ok(Math.abs(first.y - second.y) < 1 && second.x > first.x, `Desktop cards are side by side: ${geometry}`);
        assert.ok(first.y + first.height <= height && second.y + second.height <= height,
          `Both desktop cards, including session clocks, fit inside the presentation viewport: ${geometry}`);
      } else {
        assert.ok(second.y > first.y && Math.abs(second.x - first.x) < 1, `Mobile cards are stacked: ${geometry}`);
      }
      assert.equal(overflow, false, `No horizontal overflow: ${geometry}`);
    };
    await page.goto(`${server.origin}/nowplaying/`, { waitUntil: "networkidle" });
    await text("#spotify-track", spotify.item.title);
    await text("#youtube-track", youtube.item.title);
    await page.waitForFunction(() => window.LANYARD_SPOTIFY === null);
    assert.equal(await page.locator("#youtube-track script").count(), 0, "Metadata is rendered as text");
    assert.equal(await page.locator("#media-navigation").isVisible(), false, "Presentation has no carousel");
    await page.locator("#spotify-artwork").waitFor({ state: "visible" });
    await page.locator("#youtube-artwork").waitFor({ state: "visible" });
    assert.equal(await page.locator("#youtube-artwork").getAttribute("data-kind"), "channel");
    assert.equal(await page.locator("#spotify-track-link").getAttribute("href"), spotify.item.spotifyUrl);
    assert.equal(await page.locator("#youtube-video-link").getAttribute("href"), "https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(await page.locator("#spotify-track-link").isVisible(), true);
    assert.equal(await page.locator("#youtube-video-link").isVisible(), true);
    assert.match(await page.locator("#spotify-session").textContent(), /^00:10:/);
    assert.match(await page.locator("#youtube-session").textContent(), /^00:15:/);
    assert.equal(historyRequests, 0, "Standalone playback does not load desktop history or curated lists");
    await assertLayout();
    if (width > 700) {
      await page.setViewportSize({ width, height: 768 });
      await page.waitForFunction(() => innerHeight === 768);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await assertLayout();
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => innerHeight === 900);
    }

    await page.mouse.move(5, 5);
    await page.clock.fastForward(4200);
    assert.equal(await page.locator("body").evaluate(body => body.classList.contains("presentation-controls-hidden")), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("body").evaluate(body => body.classList.contains("presentation-controls-hidden")), false);
    await page.locator("#presentation-theme").focus();
    await page.clock.fastForward(4200);
    assert.equal(await page.locator("body").evaluate(body => body.classList.contains("presentation-controls-hidden")), false,
      "Keyboard-focused controls are never hidden");
    await page.locator("#presentation-auto-hide").uncheck();
    await page.mouse.move(5, 5);
    await page.clock.fastForward(4200);
    assert.equal(await page.locator("body").evaluate(body => body.classList.contains("presentation-controls-hidden")), false);

    const fullscreen = page.locator("#presentation-fullscreen");
    await fullscreen.click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    assert.equal(await fullscreen.getAttribute("aria-pressed"), "true");
    await page.keyboard.press("f");
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await fullscreen.getAttribute("aria-pressed"), "false");
    await page.locator("#presentation-theme").focus();
    await page.keyboard.press("f");
    assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), false, "Typing in controls does not toggle fullscreen");
    await page.evaluate(() => {
      document.documentElement.requestFullscreen = () => Promise.reject(new Error("Fullscreen denied by fixture"));
    });
    await fullscreen.click();
    await page.locator("#presentation-control-status").filter({ hasText: "could not be changed" }).waitFor();
    assert.equal(await fullscreen.isDisabled(), false, "A denied fullscreen request leaves controls usable");

    for (const theme of ["default", "nord", "youtube", "google", "aero-glass", "terminal", "default"]) {
      await page.locator("#presentation-theme").selectOption(theme);
      await page.waitForFunction(theme => {
        const sheet = document.querySelector("#bits-theme-stylesheet");
        return document.documentElement.dataset.interfaceTheme === theme
          && (!sheet || sheet.href.includes(`/${theme}.css`) && sheet.sheet);
      }, theme);
      assert.equal(await page.locator("#bits-layout-runtime").count(), 0, "Presentation inherits colors without mounting desktop chrome");
      assert.equal(await page.locator("#presentation-scheme").isVisible(), theme !== "terminal", "Locked theme schemes remain hidden");
      assert.equal(await page.locator("#spotify-track-link").isVisible(), true);
      assert.equal(await page.locator("#youtube-video-link").isVisible(), true);
      await assertLayout();
    }
    await page.evaluate(() => {
      localStorage.setItem("bits-interface-theme", "nord");
      window.dispatchEvent(new StorageEvent("storage", { key: "bits-interface-theme", newValue: "nord" }));
    });
    await page.waitForFunction(() => document.documentElement.dataset.interfaceTheme === "nord");
    assert.equal(await page.locator("#presentation-theme").inputValue(), "nord", "Theme changes from other pages stay synchronized");
    await page.locator("#presentation-theme").selectOption("default");
    await page.locator("#presentation-scheme").selectOption("light");
    await page.waitForFunction(() => document.documentElement.dataset.colorScheme === "light");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.addScriptTag({ path: axePath });
    // The mocked clock's animation frames do not guarantee a compositor paint.
    await page.screenshot();
    assert.deepEqual(await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({
      target: node.target, summary: node.failureSummary,
    })) }))), [], "Presentation is accessible in light mode");
    await page.locator("#presentation-scheme").selectOption("dark");
    await page.waitForFunction(() => document.documentElement.dataset.colorScheme === "dark");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".presentation-controls a")).color
      === getComputedStyle(document.querySelector(".presentation-controls")).color
      && getComputedStyle(document.querySelector("#presentation-control-status")).color
      === getComputedStyle(document.querySelector(".presentation-note")).color);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot();
    assert.deepEqual(await page.evaluate(async () => (await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({
      target: node.target, summary: node.failureSummary,
    })) }))), [], "Presentation is accessible in dark mode");

    spotify = { ...spotify, isPlaying: false, progressMs: 77_000 };
    youtube = { ...youtube, isPlaying: false, progressMs: 77_000 };
    await refresh();
    await page.waitForFunction(() => document.querySelector("#spotify-widget").dataset.state === "paused"
      && document.querySelector("#youtube-widget").dataset.state === "paused");
    const pausedTimes = await page.locator("#spotify-current-time, #youtube-current-time").allTextContents();
    const pausedSessions = await page.locator("#spotify-session, #youtube-session").allTextContents();
    await page.clock.fastForward(2100);
    assert.deepEqual(await page.locator("#spotify-current-time, #youtube-current-time").allTextContents(), pausedTimes,
      "Paused playback clocks stay frozen");
    assert.notDeepEqual(await page.locator("#spotify-session, #youtube-session").allTextContents(), pausedSessions,
      "Continuous session lengths include pauses");
    spotify = { ...spotify, item: { ...spotify.item, title: "Another track, same listening session" } };
    youtube = { ...youtube, item: { ...youtube.item, videoId: "ZYXWVUTSRQP", title: "Another video, same watching session" } };
    await refresh();
    await text("#spotify-track", spotify.item.title);
    await text("#youtube-track", youtube.item.title);
    assert.match(await page.locator("#spotify-session").textContent(), /^00:10:/, "Changing tracks does not reset the session");
    assert.match(await page.locator("#youtube-session").textContent(), /^00:15:/, "Changing videos does not reset the session");

    const spotifyItem = spotify.item;
    const youtubeItem = youtube.item;
    spotify = { ...spotify, item: null };
    youtube = { ...youtube, item: null };
    await refresh();
    await text("#spotify-session", "NO ACTIVE SESSION");
    await text("#youtube-session", "NO ACTIVE SESSION");
    assert.equal(await page.locator("#spotify-track-link").isVisible(), false);
    assert.equal(await page.locator("#youtube-video-link").isVisible(), false);
    assert.equal(await page.locator("#youtube-artwork").getAttribute("src"), null);
    await assertLayout();
    spotify = { ...spotify, item: spotifyItem, isPlaying: true };
    youtube = { ...youtube, item: youtubeItem, isPlaying: true };
    await refresh();
    await text("#spotify-track", spotifyItem.title);
    await text("#youtube-track", youtubeItem.title);

    youtubeStatus = 503;
    await refresh();
    await page.locator("#media-status").filter({ hasText: "YouTube status unavailable" }).waitFor();
    assert.equal(await page.locator("#youtube-widget").isVisible(), true, "Provider failures do not remove the presentation card");
    assert.equal(await page.locator("#spotify-widget").getAttribute("data-state"), "playing");
    assert.equal(await page.locator("#youtube-widget").getAttribute("data-state"), "unavailable");
    youtubeStatus = 200;
    spotifyStatus = 503;
    await refresh();
    await page.waitForFunction(() => document.querySelector("#spotify-widget").dataset.state === "stale"
      && document.querySelector("#youtube-widget").dataset.state === "playing");
    const staleSession = await page.locator("#spotify-session").textContent();
    const stalePosition = await page.locator("#spotify-current-time").textContent();
    assert.match(staleSession, /LAST KNOWN/);
    await page.clock.fastForward(2100);
    assert.equal(await page.locator("#spotify-session").textContent(), staleSession);
    assert.equal(await page.locator("#spotify-current-time").textContent(), stalePosition);
    spotifyStatus = 200;
    spotify = { ...spotify, sessionStartedAt: null };
    await refresh();
    await text("#spotify-session", "SESSION TIMING UNAVAILABLE");
    assert.equal(await page.locator("#youtube-widget").getAttribute("data-state"), "playing");
    spotify = { ...spotify, sessionStartedAt: new Date(fixtureNow - 600_000).toISOString() };

    youtubeExpiresAfter = 1000;
    youtube = { ...youtube, item: { ...youtube.item, title: "This shared video will expire" } };
    await refresh();
    await text("#youtube-track", youtube.item.title);
    await page.clock.fastForward(2100);
    await text("#youtube-session", "NO ACTIVE SESSION");
    assert.equal(await page.locator("#youtube-widget").isVisible(), true, "Expiry shows an idle card, never expired video metadata");
    assert.equal(await page.locator("#youtube-video-link").isVisible(), false);
    assert.equal(await page.locator("#youtube-artwork").getAttribute("src"), null);
    youtubeExpiresAfter = 90_000;
    youtube = { ...youtube, item: { ...youtube.item, title: "Automatically refreshed watched pixels" } };
    spotify = { ...spotify, item: { ...spotify.item, title: "Automatically refreshed musical bits" } };
    const requests = [spotifyRequests, youtubeRequests];
    fixtureNow = await page.evaluate(() => Date.now());
    await page.clock.fastForward(30_100);
    await text("#spotify-track", spotify.item.title);
    await text("#youtube-track", youtube.item.title);
    assert.ok(spotifyRequests > requests[0] && youtubeRequests > requests[1], "Both providers refresh automatically");

    await page.evaluate(() => {
      window.__visible = false;
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__visible ? "visible" : "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hiddenRequests = [spotifyRequests, youtubeRequests];
    await page.clock.fastForward(31_000);
    assert.deepEqual([spotifyRequests, youtubeRequests], hiddenRequests, "Hidden pages stop polling");
    fixtureNow = await page.evaluate(() => Date.now());
    spotify = { ...spotify, item: { ...spotify.item, title: "Resumed musical bits" } };
    youtube = { ...youtube, item: { ...youtube.item, title: "Resumed watched pixels" } };
    await page.evaluate(() => {
      window.__visible = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await text("#spotify-track", spotify.item.title);
    await text("#youtube-track", youtube.item.title);
    await page.waitForFunction(() => window.LANYARD_SPOTIFY === null);
    const now = await page.evaluate(() => Date.now());
    sockets.at(-1).send(JSON.stringify({ op: 0, t: "PRESENCE_UPDATE", d: {
      listening_to_spotify: true, spotify: { song: "Instant Lanyard track", artist: "Live artist",
        timestamps: { start: now - 15_000, end: now + 165_000 }, track_id: "Live123",
        album_art_url: "https://i.scdn.co/image/live-album" },
    } }));
    await text("#spotify-track", "Instant Lanyard track");
    assert.equal(await page.locator("#spotify-widget").getAttribute("data-state"), "playing");
    assert.equal(historyRequests, 0);

    const unsupported = await context.newPage();
    unsupported.on("pageerror", error => errors.push(error.message));
    await unsupported.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { get: () => false }));
    await unsupported.goto(`${server.origin}/nowplaying/`, { waitUntil: "networkidle" });
    assert.equal(await unsupported.locator("#presentation-fullscreen").isDisabled(), true);
    assert.match(await unsupported.locator("#presentation-control-status").textContent(), /not supported/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px nowplaying: simultaneous cards, artwork, sessions, pause/idle/expiry, independent failures, polling/visibility, live Lanyard, fullscreen, auto-hide, themes, safe text, and accessibility`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
