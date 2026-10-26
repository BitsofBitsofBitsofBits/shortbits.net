import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const discordSource = readFileSync(new URL("../online/scripts/discord.js", import.meta.url), "utf8");
const spotifySource = readFileSync(new URL("../online/scripts/spotify.js", import.meta.url), "utf8");

async function setup(source, initialPayload, options = {}) {
  const elements = new Map();
  const events = new Map();
  const visibility = {};
  const timeouts = new Map();
  let payload = initialPayload;
  let failure;
  let requests = 0;
  const urls = [];
  let timerId = 0;
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        dataset: {}, hidden: true, textContent: "",
        style: { setProperty() {} },
        removeAttribute() {},
      });
    }
    return elements.get(selector);
  };
  const window = {
    SUPABASE_CONFIG: { url: "https://example.test", anonKey: "public" },
    setTimeout(callback) { const id = ++timerId; timeouts.set(id, callback); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval() {}, clearInterval() {},
    addEventListener(type, callback) { events.set(type, callback); },
    dispatchEvent(event) { events.get(event.type)?.(event); },
  };
  const context = vm.createContext({
    window, Date, performance,
    document: {
      visibilityState: "visible",
      querySelector: selector => options.missing?.includes(selector) ? null : element(selector),
      addEventListener(type, callback) { visibility[type] = callback; },
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    console: { error() {}, warn() {} },
    fetch: async url => {
      requests++;
      urls.push(url);
      if (failure) throw new Error("Connection failed");
      return { ok: true, json: async () => payload };
    },
  });
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  return {
    context, element, timeouts, events, urls,
    fail() { failure = true; },
    payload(value) { failure = false; payload = value; },
    requests: () => requests,
    async refresh(name) {
      await vm.runInContext(`${name}()`, context);
    },
    hide() {
      context.document.visibilityState = "hidden";
      visibility.visibilitychange();
    },
  };
}

test("Discord retains last-known data and its timestamp through failures, then recovers", async () => {
  const presence = { enrolled: true, status: "online", customStatus: "Hello", activities: [{ name: "Coding" }] };
  const page = await setup(discordSource, presence);
  assert.equal(page.element("#discord-presence-status").textContent, "ONLINE");
  page.fail();
  await page.refresh("refreshDiscordPresence");
  assert.match(page.element("#discord-presence-status").textContent, /ONLINE \/\/ LAST KNOWN/);
  assert.equal(page.element("#discord-custom-status").textContent, "Hello");
  assert.equal(page.element("#discord-activity").textContent, "Coding");
  page.payload({ ...presence, status: "idle" });
  await page.refresh("refreshDiscordPresence");
  assert.equal(page.element("#discord-presence-status").textContent, "IDLE");
  assert.equal(page.element("#discord-presence-status").dataset.state, "fresh");
  page.hide();
  assert.equal(page.timeouts.size, 0);
  const requests = page.requests();
  await page.refresh("refreshDiscordPresence");
  assert.equal(page.requests(), requests);
});

test("Discord never labels stale server-cache responses as fresh", async () => {
  const page = await setup(discordSource, {
    enrolled: true, status: "online", stale: true, cacheAgeMs: 600_000,
  });
  assert.equal(page.element("#discord-presence-status").dataset.state, "stale");
  assert.match(page.element("#discord-presence-status").textContent, /LAST KNOWN/);
});

const playback = {
  isPlaying: true, progressMs: 10_000, cacheAgeMs: 0,
  item: {
    title: "Example track", artists: ["Example artist"], durationMs: 180_000,
    albumArt: null, collection: "Example album", spotifyUrl: null,
  },
};

test("Spotify preserves last-known track on errors and freezes its live clock", async () => {
  const page = await setup(spotifySource, playback);
  assert.equal(page.element("#spotify-state").textContent, "NOW LISTENING");
  page.fail();
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(page.element("#spotify-track").textContent, "Example track");
  assert.match(page.element("#spotify-state").textContent, /LAST KNOWN/);
  assert.equal(vm.runInContext("playbackClock.isPlaying", page.context), false);
  page.payload(playback);
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(page.element("#spotify-state").textContent, "NOW LISTENING");
  page.hide();
  assert.equal(page.timeouts.size, 0);
  const requests = page.requests();
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(page.requests(), requests);
});

test("Spotify cache fallback always shows last-known time, including no active playback", async () => {
  const page = await setup(spotifySource, { ...playback, cacheStatus: "stale", cacheAgeMs: 300_000 });
  assert.equal(page.element("#spotify-widget").dataset.state, "stale");
  assert.match(page.element("#spotify-state").textContent, /LAST KNOWN/);
  assert.equal(vm.runInContext("playbackClock.isPlaying", page.context), false);
  page.payload({ ...playback, item: null, cacheStatus: "stale" });
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(page.element("#spotify-widget").dataset.state, "stale");
  assert.match(page.element("#spotify-state").textContent, /LAST KNOWN/);
});

test("presentation Spotify publishes observed session metadata without requesting desktop history", async () => {
  const sessionStartedAt = new Date(Date.now() - 600_000).toISOString();
  const page = await setup(spotifySource, { ...playback, sessionStartedAt }, { missing: ["#spotify-window"] });
  assert.equal(page.urls.length, 1);
  assert.match(page.urls[0], /\/spotify-now-playing$/);
  let detail;
  page.context.window.addEventListener("media:spotify", event => { detail = event.detail; });
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(detail.available, true);
  assert.equal(detail.state, "playing");
  assert.equal(detail.sessionStartedAt, sessionStartedAt);
  assert.ok(detail.updatedAt > 0);
  page.fail();
  await page.refresh("refreshSpotifyPlayback");
  assert.equal(detail.state, "stale");
  assert.equal(detail.sessionStartedAt, sessionStartedAt);
});

test("Lanyard Spotify updates work without rendering a Discord status panel", async () => {
  const presence = { enrolled: true, status: "online" };
  const page = await setup(discordSource, presence, {
    missing: ["#discord-presence-status", "#discord-custom-status", "#discord-activity"],
  });
  assert.equal(vm.runInContext("discordLastPresence.status", page.context), "online");
  let detail;
  page.context.window.addEventListener("lanyard:spotify", event => { detail = event.detail; });
  vm.runInContext(`publishLanyardSpotify({ listening_to_spotify: true, spotify: {
    song: "Live song", artist: "Live artist", timestamps: { start: 1000, end: 181000 }
  } })`, page.context);
  assert.equal(detail.song, "Live song");
  assert.equal(detail.artist, "Live artist");
  page.payload({ enrolled: false });
  await page.refresh("refreshDiscordPresence");
  assert.equal(vm.runInContext("discordLastPresence", page.context), undefined);
});
