import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const extensionPath = resolve("extensions", "youtube-presence");
const profile = await mkdtemp(join(tmpdir(), "shortbits-extension-test-"));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const errors = [];
  context.on("weberror", error => errors.push(error.error().message));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const id = new URL(worker.url()).hostname;
  await worker.evaluate(() => {
    self.__reports = [];
    self.__spotifyRequests = 0;
    self.fetch = async (url, options) => {
      if (url.endsWith("youtube-presence")) {
        self.__reports.push(JSON.parse(options.body));
        return Response.json({ ok: true });
      }
      if (url.endsWith("spotify-now-playing")) {
        self.__spotifyRequests++;
        return Response.json({ item: null });
      }
      throw new Error("Unexpected external request");
    };
  });
  const youtube = await context.newPage();
  await youtube.route("https://www.youtube.com/**", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><title>A browser test video - YouTube</title><ytd-watch-flexy video-id="abcdefghijk"><h1 class="ytd-watch-metadata"><yt-formatted-string>Browser test video</yt-formatted-string></h1><div id="channel-name"><a>Browser test channel</a></div><video class="html5-main-video"></video></ytd-watch-flexy>',
  }));
  await youtube.goto("https://www.youtube.com/watch?v=abcdefghijk");
  const cdp = await context.newCDPSession(youtube);
  const worlds = [];
  cdp.on("Runtime.executionContextCreated", event => worlds.push(event.context));
  await cdp.send("Runtime.enable");
  const isolated = worlds.find(world => world.origin === `chrome-extension://${id}`);
  assert.ok(isolated, "The extension runs in an isolated content-script world");
  await cdp.send("Runtime.evaluate", { contextId: isolated.id, expression: `
    self.__paused = false;
    Object.defineProperties(HTMLMediaElement.prototype, {
      paused: { get: () => self.__paused },
      currentTime: { get: () => 12 },
      duration: { get: () => 180 },
      readyState: { get: () => 4 },
      ended: { get: () => false },
    });
  ` });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.locator("#status").filter({ hasText: "Sharing is off." }).waitFor();
  assert.equal(await worker.evaluate(() => self.__reports.length), 0, "Installation must not publish anything");
  await popup.locator("#token").fill(`sbyt_${"a".repeat(64)}`);
  await popup.locator("#enabled").check();
  await popup.locator("#save").click();
  await popup.locator("#save").waitFor({ state: "visible" });
  await popup.waitForFunction(() => !document.querySelector("#save").disabled);
  assert.match(await popup.locator("#status").textContent(), /Sharing is on\./, "Pairing should confirm sharing");
  const report = await worker.evaluate(() => self.__reports.at(-1));
  assert.equal(report.item.title, "Browser test video");
  assert.equal(report.item.channel, "Browser test channel");
  assert.equal(report.item.isPlaying, true);
  assert.equal(report.item.progressMs, 12000);
  assert.equal(await worker.evaluate(() => self.__spotifyRequests), 1);
  const access = await cdp.send("Runtime.evaluate", {
    contextId: isolated.id, awaitPromise: true, returnByValue: true,
    expression: "chrome.storage.local.get('token').then(result => !result.token).catch(() => true)",
  });
  assert.equal(access.result.value, true, "Content scripts cannot access the pairing token");
  await cdp.send("Runtime.evaluate", { contextId: isolated.id,
    expression: 'self.__paused = true; document.querySelector("video").dispatchEvent(new Event("pause", { bubbles: true }));' });
  await worker.evaluate(async () => {
    const deadline = Date.now() + 5000;
    while (self.__reports.at(-1)?.item?.isPlaying !== false) {
      if (Date.now() > deadline) throw new Error("Pause event was not published");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });
  await youtube.close();
  await worker.evaluate(async () => {
    const deadline = Date.now() + 5000;
    while (self.__reports.at(-1)?.item !== null) {
      if (Date.now() > deadline) throw new Error("Closing YouTube did not clear its report");
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });
  assert.deepEqual(await worker.evaluate(() => self.__reports.at(-1)), { item: null, endSession: false });
  await popup.locator("#enabled").uncheck();
  await popup.locator("#save").click();
  await popup.locator("#status").filter({ hasText: "Sharing is off." }).waitFor();
  assert.deepEqual(await worker.evaluate(() => self.__reports.at(-1)), { item: null, endSession: true });
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get("enabled")).enabled), false);
  assert.deepEqual(errors, []);
  console.log("PASS real Chromium extension: install off, popup pairing, isolated token storage, playback/pause reports, Spotify observation, tab-close clearing, and opt-out");
} finally {
  if (context) await context.close();
  await rm(profile, { recursive: true, force: true });
}
