import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const base = new URL("../extensions/youtube-presence/", import.meta.url);
const playbackSource = readFileSync(new URL("playback.js", base), "utf8");
const workerSource = readFileSync(new URL("background.js", base), "utf8");
const contentSource = readFileSync(new URL("content.js", base), "utf8");
const token = `sbyt_${"a".repeat(64)}`;
const item = { videoId: "abcdefghijk", title: "Example video", channel: "Example channel", isPlaying: true, progressMs: 1000, durationMs: 180000 };

function setup(options = {}) {
  const storage = { ...options.storage };
  const calls = [];
  const events = {};
  const logs = [];
  const badges = [];
  const context = vm.createContext({
    URL, AbortSignal, Response, setTimeout, clearTimeout,
    console: { error: (...args) => logs.push(args.join(" ")), warn: (...args) => logs.push(args.join(" ")) },
    importScripts() {},
    chrome: {
      storage: { local: {
        get: async () => ({ ...storage }), set: async values => Object.assign(storage, values),
        setAccessLevel: async value => { storage.accessLevel = value.accessLevel; },
      } },
      action: { setBadgeText: async value => badges.push(value.text), setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
      alarms: { create: async () => {}, onAlarm: { addListener: value => { events.alarm = value; } } },
      tabs: {
        query: async () => options.tabs ?? [],
        sendMessage: async id => {
          if (options.unavailable) throw new Error("No content script");
          return options.reports?.[id] ?? { item: null };
        },
        onRemoved: { addListener: value => { events.removed = value; } },
        onUpdated: { addListener: value => { events.updated = value; } },
      },
      runtime: { id: "extension-id", getURL: () => "chrome-extension://extension-id/",
        onMessage: { addListener: value => { events.message = value; } },
        onInstalled: { addListener: value => { events.installed = value; } },
        onStartup: { addListener: value => { events.startup = value; } } },
    },
    fetch: async (url, init) => {
      calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
      if (options.fail) throw new Error("Network unavailable");
      return Response.json(url.endsWith("spotify-now-playing") ? { item: null } : { ok: true });
    },
  });
  vm.runInContext(playbackSource, context);
  vm.runInContext(workerSource, context);
  return { storage, calls, logs, badges, events, context,
    run: code => vm.runInContext(code, context),
    configure: value => { context.__config = value; return vm.runInContext("configure(__config)", context); } };
}

test("extension permissions are narrow, incognito is excluded, and sharing starts off", async () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8"));
  assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
  assert.equal(manifest.incognito, "not_allowed");
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.youtube.com/*"]);
  const extension = setup();
  await extension.run("initialize()");
  assert.equal(extension.storage.accessLevel, "TRUSTED_CONTEXTS");
  assert.equal(extension.calls.length, 0);
  await extension.configure({ enabled: false, token: "" });
  assert.equal(extension.storage.enabled, false);
  await assert.rejects(extension.configure({ enabled: true, token: "" }), /device token/);
  assert.equal(extension.calls.length, 0);
});

test("playing YouTube tabs outrank paused tabs; the worker alone receives credentials", async () => {
  const extension = setup({ tabs: [{ id: 1, active: true }, { id: 2, active: false }],
    reports: { 1: { item: { ...item, isPlaying: false } }, 2: { item: { ...item, title: "Playing tab" } } } });
  await extension.configure({ enabled: true, token });
  const report = extension.calls.find(call => call.url.endsWith("youtube-presence"));
  assert.equal(report.body.item.title, "Playing tab");
  assert.equal(report.init.headers["x-device-token"], token);
  assert.ok(extension.calls.some(call => call.url.endsWith("spotify-now-playing")), "Spotify stays observable without a site visitor");
  assert.equal(extension.storage.currentTitle, "Playing tab");
  assert.ok(extension.badges.includes("ON"));
  let responded = false;
  extension.events.message({ type: "configure", token, enabled: true },
    { id: "extension-id", tab: { id: 1 }, url: "https://www.youtube.com/watch?v=abcdefghijk" },
    () => { responded = true; });
  assert.equal(responded, false, "Content scripts cannot configure sharing");
});

test("disabling sharing immediately clears the report and ends its continuous session", async () => {
  const extension = setup({ storage: { enabled: true, token } });
  await extension.configure({ enabled: false, token: "" });
  assert.equal(extension.storage.enabled, false);
  assert.deepEqual(extension.calls[0].body, { item: null, endSession: true });
  const count = extension.calls.length;
  await extension.run("update()");
  assert.equal(extension.calls.length, count);
});

test("failed clears leave sharing off and explicitly explain expiry; network failures are visible", async () => {
  const extension = setup({ storage: { enabled: true, token }, fail: true });
  await assert.rejects(extension.configure({ enabled: false }), /Sharing is off.*90 seconds/);
  assert.equal(extension.storage.enabled, false);
  const enabled = setup({ storage: { enabled: true, token }, fail: true });
  await assert.rejects(enabled.run("enqueue(update)"), /Network unavailable/);
  await enabled.run("queue");
  assert.match(enabled.storage.lastError, /Network unavailable/);
  assert.ok(enabled.logs.length);
  assert.ok(enabled.badges.includes("!"));
});

test("navigation and ads do not publish their metadata or end a continuous viewing session", async () => {
  const extension = setup({ storage: { enabled: true, token }, tabs: [{ id: 1 }],
    reports: { 1: { transient: true } } });
  await extension.run("update()");
  assert.equal(extension.calls.filter(call => call.url.endsWith("youtube-presence")).length, 0);
  assert.equal(extension.calls.length, 1, "Spotify heartbeat still runs");
  const disconnected = setup({ storage: { enabled: true, token }, tabs: [{ id: 1 }], unavailable: true });
  await assert.rejects(disconnected.run("update()"), /Reload existing YouTube tabs/);
  assert.equal(disconnected.calls.filter(call => call.url.endsWith("youtube-presence")).length, 0);
});

test("content snapshots only expose a real watch video and handle pauses, seeks, ads, and stale navigation", () => {
  const listeners = {};
  let location = { href: "https://www.youtube.com/watch?v=abcdefghijk", pathname: "/watch" };
  class Video {}
  const video = Object.assign(new Video(), { paused: false, ended: false, currentTime: 2, duration: 100, readyState: 4 });
  let containerId = "abcdefghijk";
  let ad = false;
  let avatar = "https://yt3.ggpht.com/example=s88-c-k-c0x00ffffff-no-rj";
  const container = { getAttribute: () => containerId,
    querySelector: selector => selector.includes("video") ? video : { textContent: "Channel name" },
    querySelectorAll: () => [{ currentSrc: avatar, getAttribute: () => null }] };
  const context = vm.createContext({
    URL, location, HTMLVideoElement: Video, console,
    document: {
      title: "Fallback video - YouTube",
      querySelector: selector => selector.includes("ad-showing") ? ad
        : selector.includes("watch-flexy") || selector.includes("reel-video-renderer") && !selector.includes("h2") ? container
        : selector.includes("formatted-string") || selector.includes("h2") ? { textContent: "A title" } : null,
      addEventListener: (type, callback) => { listeners[type] = callback; },
    },
    chrome: { runtime: { id: "extension-id", onMessage: { addListener: callback => { listeners.message = callback; } },
      sendMessage: async () => ({ ok: true }) } },
  });
  vm.runInContext(playbackSource, context);
  vm.runInContext(contentSource, context);
  const snapshot = () => {
    let result;
    listeners.message({ type: "snapshot" }, { id: "extension-id" }, value => { result = value; });
    return result;
  };
  assert.equal(snapshot().item.title, "A title");
  assert.equal(snapshot().item.channelAvatarUrl, avatar);
  avatar = "https://untrusted.example/channel.jpg";
  assert.equal(snapshot().item.channelAvatarUrl, null, "Unapproved images are not published");
  avatar = "";
  assert.equal(snapshot().item.channelAvatarUrl, null, "Missing artwork does not stop playback sharing");
  location.href = "https://www.youtube.com/shorts/abcdefghijk";
  location.pathname = "/shorts/abcdefghijk";
  avatar = "https://yt3.googleusercontent.com/ytc/short-channel=s88-c";
  assert.equal(snapshot().item.channelAvatarUrl, avatar, "Active Shorts also report their channel icon");
  location.href = "https://www.youtube.com/watch?v=abcdefghijk";
  location.pathname = "/watch";
  video.paused = true;
  assert.equal(snapshot().item.isPlaying, false);
  video.currentTime = 12;
  assert.equal(snapshot().item.progressMs, 12000);
  ad = true;
  assert.equal(snapshot().transient, true);
  ad = false;
  containerId = "ZYXWVUTSRQP";
  assert.equal(snapshot().transient, true);
  location.href = "https://www.youtube.com/";
  assert.equal(snapshot().item, null);
});

test("channel icons are optional and limited to public YouTube image hosts without query strings", () => {
  const extension = setup();
  extension.context.__item = item;
  for (const url of [null, undefined, "https://yt3.ggpht.com/channel=s88-c",
    "https://yt3.googleusercontent.com/ytc/channel=s88-c"]) {
    extension.context.__avatar = url;
    assert.equal(extension.run("BITS_YOUTUBE.validPlayback({ ...__item, channelAvatarUrl: __avatar })"), true);
  }
  for (const url of ["http://yt3.ggpht.com/channel", "https://yt3.ggpht.com.evil.example/channel",
    "https://yt3.ggpht.com@evil.example/channel", "https://yt3.ggpht.com:444/channel",
    "https://yt3.ggpht.com/channel?private=value", "https://yt3.ggpht.com/channel#fragment",
    "https://yt3.ggpht.com/\\evil.example", "https://yt3.ggpht.com/white space",
    `https://yt3.ggpht.com/${"a".repeat(2048)}`, 42, {}]) {
    extension.context.__avatar = url;
    assert.equal(extension.run("BITS_YOUTUBE.validPlayback({ ...__item, channelAvatarUrl: __avatar })"), false);
  }
});

test("watch and Shorts URL recognition excludes unrelated hosts, playlists, and malformed video IDs", () => {
  const extension = setup();
  for (const url of ["https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk"]) {
    extension.context.__url = url;
    assert.equal(extension.run("BITS_YOUTUBE.videoId(__url)"), "abcdefghijk");
  }
  for (const url of ["https://www.youtube.com/feed/history", "https://www.youtube.com/playlist?list=example",
    "https://www.youtube.com/watch?v=invalid", "https://www.youtube.com.evil.example/watch?v=abcdefghijk"]) {
    extension.context.__url = url;
    assert.equal(extension.run("BITS_YOUTUBE.videoId(__url)"), null);
  }
});
